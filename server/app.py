#!/usr/bin/env python3
"""拾页 · 任务 API（过渡期，零依赖标准库实现）。

这一版只做「任务底座」：
- 创建任务 → 后台 mock 流水线 → SSE 推送步骤/来源/增量文本 → done
- 数据落 SQLite，事件可回放
- 接口按 docs/代码规范.md 的 /api/v1 契约设计，后续可平移到 FastAPI

启动：
    py -3 server/app.py
    py -3 server/app.py --port 8000
"""

from __future__ import annotations

import argparse
import json
import queue
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from llm import LLMClient, LLMError

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "shiye.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    published_at TEXT,
    excerpt TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(task_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id, seq);
CREATE INDEX IF NOT EXISTS idx_sources_task ON sources(task_id);
"""

MOCK_SOURCES = [
    {
        "title": "小米 14 评测：徕卡三摄的实力担当",
        "url": "https://www.zol.com.cn/example/xiaomi14",
        "domain": "中关村在线",
        "published_at": "2024-03-15",
        "excerpt": "小米 14 售价 3999 元起，搭载骁龙 8 Gen 3 处理器与 5000 万像素徕卡主摄，拍照、性能和续航表现均衡。",
    },
    {
        "title": "OPPO Find X7 体验：影像与性能的平衡之选",
        "url": "https://www.ithome.com/example/findx7",
        "domain": "IT之家",
        "published_at": "2024-03-10",
        "excerpt": "OPPO Find X7 售价 4599 元起，采用索尼 LYT-800 主摄，支持 100W 超级闪充，视频防抖和续航是强项。",
    },
    {
        "title": "vivo X100 Pro 测评：蔡司影像的专业表现",
        "url": "https://www.zealer.com/example/x100pro",
        "domain": "ZEALER",
        "published_at": "2024-03-08",
        "excerpt": "vivo X100 Pro 售价 4299 元起，搭载蔡司 T* 镀膜镜头，成像质量优秀，视频防抖和色彩调校突出，但机身偏重。",
    },
]

MOCK_PHONES = [
    {
        "name": "小米 14",
        "price": "¥3,999",
        "camera": "5000 万像素 · 徕卡主摄",
        "battery": "4610mAh / 90W",
        "downside": "长焦较短，散热一般",
        "recommended": True,
    },
    {
        "name": "OPPO Find X7",
        "price": "¥4,599",
        "camera": "5000 万像素 · 索尼主摄",
        "battery": "5000mAh / 100W",
        "downside": "算法色彩偏浓",
    },
    {
        "name": "vivo X100 Pro",
        "price": "¥4,299",
        "camera": "5000 万像素 · 蔡司主摄",
        "battery": "5000mAh / 120W",
        "downside": "系统体验一般",
    },
]

MOCK_CONCLUSION = (
    "综合来看，小米 14 在影像表现、系统体验与整体均衡性上最为突出，适合追求全能体验的用户；"
    "OPPO Find X7 的视频防抖更有优势，vivo X100 Pro 则偏重续航和性能。"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@contextmanager
def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=8)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def db_create_task(goal: str) -> dict:
    task_id = "t_" + uuid.uuid4().hex[:10]
    ts = utc_now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO tasks(id, goal, status, created_at, updated_at) VALUES(?,?,?,?,?)",
            (task_id, goal, "queued", ts, ts),
        )
    return {"id": task_id, "goal": goal, "status": "queued", "created_at": ts}


def db_set_status(task_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE tasks SET status=?, result=?, error=?, updated_at=? WHERE id=?",
            (
                status,
                json.dumps(result, ensure_ascii=False) if result is not None else None,
                error,
                utc_now(),
                task_id,
            ),
        )


def db_get_task(task_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        return None
    item = dict(row)
    item["result"] = json.loads(item["result"]) if item["result"] else None
    return item


def db_add_source(task_id: str, source: dict) -> dict:
    source_id = "s_" + uuid.uuid4().hex[:8]
    with connect() as conn:
        conn.execute(
            """INSERT INTO sources(id, task_id, title, url, domain, published_at, excerpt, created_at)
               VALUES(?,?,?,?,?,?,?,?)""",
            (
                source_id,
                task_id,
                source["title"],
                source["url"],
                source["domain"],
                source["published_at"],
                source["excerpt"],
                utc_now(),
            ),
        )
    return {**source, "id": source_id}


def db_list_sources(task_id: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM sources WHERE task_id=? ORDER BY id", (task_id,)).fetchall()
    return [dict(row) for row in rows]


class EventBus:
    """任务事件：先落库，再推给在线订阅者；SSE 重连可回放。"""

    def __init__(self) -> None:
        self._subs: dict[str, list[queue.Queue]] = {}
        self._lock = threading.Lock()

    def subscribe(self, task_id: str) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subs.setdefault(task_id, []).append(q)
        return q

    def unsubscribe(self, task_id: str, q: queue.Queue) -> None:
        with self._lock:
            items = self._subs.get(task_id, [])
            if q in items:
                items.remove(q)
            if not items:
                self._subs.pop(task_id, None)

    def publish(self, task_id: str, event: str, payload: dict) -> None:
        with connect() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM events WHERE task_id=?",
                (task_id,),
            ).fetchone()
            seq = int(row["seq"])
            data = {**payload, "type": event, "seq": seq}
            conn.execute(
                "INSERT INTO events(task_id, seq, event, data, created_at) VALUES(?,?,?,?,?)",
                (task_id, seq, event, json.dumps(data, ensure_ascii=False), utc_now()),
            )
        with self._lock:
            subscribers = list(self._subs.get(task_id, []))
        for q in subscribers:
            try:
                q.put_nowait((event, data))
            except queue.Full:
                pass

    @staticmethod
    def history(task_id: str) -> list[tuple[str, dict]]:
        with connect() as conn:
            rows = conn.execute(
                "SELECT event, data FROM events WHERE task_id=? ORDER BY seq", (task_id,)
            ).fetchall()
        return [(r["event"], json.loads(r["data"])) for r in rows]


BUS = EventBus()
CANCELS: dict[str, threading.Event] = {}


class TaskRunner(threading.Thread):
    def __init__(self, task_id: str, goal: str) -> None:
        super().__init__(daemon=True, name=f"task-{task_id}")
        self.task_id = task_id
        self.goal = goal
        self.cancel = threading.Event()
        self.llm = LLMClient()
        CANCELS[task_id] = self.cancel

    # ------------------------------------------------------------------
    def _step(self, name: str, label: str, status: str = "done", detail: str = "") -> None:
        BUS.publish(
            self.task_id,
            "step",
            {"name": name, "label": label, "status": status, "detail": detail},
        )

    def _cancelled(self) -> bool:
        if not self.cancel.is_set():
            return False
        db_set_status(self.task_id, "cancelled", error="任务已取消")
        BUS.publish(self.task_id, "error", {"code": "CANCELLED", "message": "任务已取消"})
        return True

    def _sleep(self, seconds: float) -> bool:
        # 分片等待，取消能及时生效
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            if self.cancel.is_set():
                self._cancelled()
                return False
            time.sleep(0.05)
        if self.cancel.is_set():
            self._cancelled()
            return False
        return True

    # ------------------------------------------------------------------
    def run(self) -> None:
        try:
            db_set_status(self.task_id, "running")
            self._step("plan", "拆解目标：拍照、预算、续航、差评", "done")
            if not self._sleep(0.6) or self._cancelled():
                return

            self._step("search", "搜索 3 个来源", "running")
            if not self._sleep(0.8) or self._cancelled():
                return

            items = []
            for source in MOCK_SOURCES:
                if not self._sleep(0.35) or self._cancelled():
                    return
                items.append(db_add_source(self.task_id, source))
                self._step("read", f"阅读：{source['domain']}", "done")

            BUS.publish(self.task_id, "sources", {"items": items})

            self._step("compare", "对齐价格、主摄、续航与差评", "done")
            if not self._sleep(0.4) or self._cancelled():
                return

            used_llm = False
            conclusion = self._generate_conclusion(items)
            if conclusion:
                used_llm = True
            else:
                for chunk in _chunks(MOCK_CONCLUSION, 18):
                    if not self._sleep(0.06) or self._cancelled():
                        return
                    BUS.publish(self.task_id, "delta", {"text": chunk})
                conclusion = MOCK_CONCLUSION

            result = {
                "goal": self.goal,
                "summary": conclusion,
                "phones": MOCK_PHONES,
                "sources": items,
                "mock": not used_llm,
                "model": self.llm.model if used_llm else "mock",
            }
            db_set_status(self.task_id, "done", result=result)
            self._step("done", "生成结论", "done")
            BUS.publish(self.task_id, "done", {"result": result})
        except Exception as exc:  # noqa: BLE001
            db_set_status(self.task_id, "error", error=str(exc))
            BUS.publish(self.task_id, "error", {"code": "TASK_FAILED", "message": str(exc)})
        finally:
            CANCELS.pop(self.task_id, None)

    def _generate_conclusion(self, sources: list[dict]) -> str | None:
        """真实模型生成；失败时返回 None，由调用方回退 mock。"""
        if not self.llm.configured:
            return None
        source_lines = "\n".join(
            f"[{index + 1}] {item['domain']}：{item['excerpt']}"
            for index, item in enumerate(sources)
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "你是拾页的调研助手。只根据用户给的来源回答，用中文写 2–4 句结论；"
                    "不要编造来源里没有的数字；结尾用 [1][2][3] 标出引用。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"用户目标：{self.goal}\n\n可用来源：\n{source_lines}\n\n"
                    "请对比这些来源，给出面向普通用户的购买建议。"
                ),
            },
        ]
        chunks: list[str] = []
        try:
            for text in self.llm.stream(messages, temperature=0.35, max_tokens=320, timeout=90):
                if self.cancel.is_set():
                    break
                chunks.append(text)
                BUS.publish(self.task_id, "delta", {"text": text})
        except LLMError as exc:
            print(f"[llm] 生成失败，回退 mock：{exc}")
            if not chunks:
                return None
        text = "".join(chunks).strip()
        return text or None


def _chunks(text: str, size: int) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)]


class Handler(BaseHTTPRequestHandler):
    server_version = "ShiyeAPI/0.1"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # 安静一点
        print(f"[api] {self.address_string()} {fmt % args}")

    # ------------------------------------------------------------------
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str) -> None:
        self._json({"error": {"code": code, "message": message}}, status)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > 1_000_000:
            raise ValueError("请求体过大")
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8"))
        return value if isinstance(value, dict) else {}

    def _sse_start(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self._cors()
        self.end_headers()
        self.close_connection = True

    def _sse(self, event: str, data: dict) -> None:
        payload = json.dumps(data, ensure_ascii=False)
        self.wfile.write(f"event: {event}\ndata: {payload}\n\n".encode("utf-8"))
        self.wfile.flush()

    # ------------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/v1/health":
            client = LLMClient()
            return self._json(
                {
                    "data": {
                        "ok": True,
                        "time": utc_now(),
                        "llm": {"configured": client.configured, "model": client.model},
                    }
                }
            )

        if path.startswith("/api/v1/tasks/") and path.endswith("/stream"):
            task_id = path[len("/api/v1/tasks/") : -len("/stream")]
            return self._stream(task_id)

        if path.startswith("/api/v1/tasks/"):
            task_id = path[len("/api/v1/tasks/") :]
            task = db_get_task(task_id)
            if not task:
                return self._error(404, "TASK_NOT_FOUND", "任务不存在")
            task["sources"] = db_list_sources(task_id)
            return self._json({"data": task})

        return self._error(404, "NOT_FOUND", "接口不存在")

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
        except Exception:
            return self._error(400, "BAD_REQUEST", "请求体不是合法 JSON")

        if path == "/api/v1/tasks":
            goal = str(body.get("goal") or "").strip()
            if not goal:
                return self._error(400, "INVALID_GOAL", "goal 不能为空")
            if len(goal) > 500:
                return self._error(400, "INVALID_GOAL", "goal 不能超过 500 字")
            task = db_create_task(goal)
            TaskRunner(task["id"], goal).start()
            return self._json({"data": task}, 201)

        if path.startswith("/api/v1/tasks/") and path.endswith("/cancel"):
            task_id = path[len("/api/v1/tasks/") : -len("/cancel")]
            task = db_get_task(task_id)
            if not task:
                return self._error(404, "TASK_NOT_FOUND", "任务不存在")
            runner = CANCELS.get(task_id)
            if runner:
                runner.set()
            return self._json({"data": {"id": task_id, "status": "cancelling"}})

        return self._error(404, "NOT_FOUND", "接口不存在")

    # ------------------------------------------------------------------
    def _stream(self, task_id: str) -> None:
        task = db_get_task(task_id)
        if not task:
            return self._error(404, "TASK_NOT_FOUND", "任务不存在")

        q = BUS.subscribe(task_id)
        try:
            self._sse_start()
            for event, data in BUS.history(task_id):
                self._sse(event, data)

            if task["status"] in ("done", "error", "cancelled"):
                return

            while True:
                try:
                    event, data = q.get(timeout=15)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    current = db_get_task(task_id)
                    if current and current["status"] in ("done", "error", "cancelled"):
                        return
                    continue
                self._sse(event, data)
                if event in ("done", "error"):
                    return
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            BUS.unsubscribe(task_id, q)


def main() -> None:
    parser = argparse.ArgumentParser(description="拾页任务 API")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    init_db()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    print(f"拾页 API: http://{args.host}:{args.port}/api/v1/health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已退出")


if __name__ == "__main__":
    main()
