"""冒烟测试：创建任务 → 读 SSE → 打印结果。

用法：
    py -3 server/tools/smoke_test.py "帮我选一台 4000-5000 的拍照手机"
"""

from __future__ import annotations

import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8000"


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def stream(task_id: str) -> dict:
    req = urllib.request.Request(f"{BASE}/api/v1/tasks/{task_id}/stream")
    result = {}
    event = ""
    with urllib.request.urlopen(req, timeout=120) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").rstrip("\r\n")
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = json.loads(line[5:].strip())
                kind = data.get("type")
                if kind == "step":
                    print(f"  [{data.get('seq')}] {data.get('name')} · {data.get('label')}")
                elif kind == "sources":
                    print(f"  [{data.get('seq')}] sources: {len(data.get('items', []))}")
                elif kind == "delta":
                    print(data.get("text", ""), end="", flush=True)
                elif kind == "done":
                    result = data.get("result", {})
                    print("\n  done")
                elif kind == "error":
                    print(f"\n  error: {data}")
            elif line == "":
                event = ""
    return result


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    goal = " ".join(sys.argv[1:]) or "帮我选一台 4000-5000 的拍照手机"
    created = post("/api/v1/tasks", {"goal": goal})
    task = created["data"]
    print(f"task {task['id']} · {task['status']}")
    result = stream(task["id"])

    with urllib.request.urlopen(f"{BASE}/api/v1/tasks/{task['id']}", timeout=10) as resp:
        detail = json.loads(resp.read().decode("utf-8"))["data"]
    print("status:", detail["status"])
    print("sources:", len(detail.get("sources", [])))
    print("phones:", len(result.get("phones", [])))
    print("summary:", result.get("summary", "")[:80], "…")


if __name__ == "__main__":
    main()
