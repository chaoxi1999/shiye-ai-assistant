"""DeepSeek / OpenAI 兼容接口的最小客户端。

只用标准库，读 server/.env：
  LLM_BASE_URL=https://api.deepseek.com/v1
  LLM_API_KEY=sk-...
  LLM_MODEL=deepseek-chat

Key 不会打印、不会写日志；出错只抛类型化信息。
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterator

ENV_PATH = Path(__file__).with_name(".env")


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_PATH.exists():
        return values
    for raw in ENV_PATH.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class LLMError(RuntimeError):
    pass


class LLMClient:
    def __init__(self) -> None:
        env = load_env()
        self.base_url = (env.get("LLM_BASE_URL") or "https://api.deepseek.com/v1").rstrip("/")
        if not self.base_url.endswith("/v1"):
            self.base_url += "/v1"
        self.api_key = env.get("LLM_API_KEY") or ""
        self.model = env.get("LLM_MODEL") or "deepseek-chat"

    @property
    def configured(self) -> bool:
        return bool(self.api_key) and "xxx" not in self.api_key.lower()

    def _request(self, messages: list[dict], temperature: float, max_tokens: int,
                 stream: bool, timeout: float) -> urllib.request.Request:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        return urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "text/event-stream" if stream else "application/json",
            },
            method="POST",
        )

    def chat(self, messages: list[dict], temperature: float = 0.3,
             max_tokens: int = 600, timeout: float = 60) -> str:
        if not self.configured:
            raise LLMError("未配置 LLM_API_KEY")
        try:
            with urllib.request.urlopen(
                self._request(messages, temperature, max_tokens, False, timeout),
                timeout=timeout,
            ) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                payload = json.loads(exc.read().decode("utf-8", "replace"))
                detail = (payload.get("error") or {}).get("message", "")
            except Exception:
                detail = ""
            raise LLMError(f"模型接口 {exc.code}：{detail[:120]}") from exc
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"模型请求失败：{type(exc).__name__}") from exc
        return ((body.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()

    def stream(self, messages: list[dict], temperature: float = 0.3,
               max_tokens: int = 600, timeout: float = 90) -> Iterator[str]:
        if not self.configured:
            raise LLMError("未配置 LLM_API_KEY")
        try:
            response = urllib.request.urlopen(
                self._request(messages, temperature, max_tokens, True, timeout),
                timeout=timeout,
            )
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                payload = json.loads(exc.read().decode("utf-8", "replace"))
                detail = (payload.get("error") or {}).get("message", "")
            except Exception:
                detail = ""
            raise LLMError(f"模型接口 {exc.code}：{detail[:120]}") from exc
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"模型请求失败：{type(exc).__name__}") from exc

        try:
            for raw in response:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except Exception:
                    continue
                choices = event.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                text = delta.get("content")
                if text:
                    yield text
        finally:
            response.close()
