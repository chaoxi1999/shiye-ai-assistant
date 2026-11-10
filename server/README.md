# 拾页 · 任务 API

零依赖 Python 标准库实现的任务底座，接口按 `docs/代码规范.md` 的 `/api/v1` 契约设计。

## 启动

```bat
py -3 server/app.py --port 8000
```

健康检查：http://127.0.0.1:8000/api/v1/health

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/tasks` | `{goal}` 创建任务，返回 `{id,status}` |
| GET | `/api/v1/tasks/{id}` | 任务状态、来源、结果 |
| GET | `/api/v1/tasks/{id}/stream` | SSE：step / sources / delta / done / error |
| POST | `/api/v1/tasks/{id}/cancel` | 取消任务 |
| GET | `/api/v1/health` | 健康检查 |

## 冒烟测试

```bat
py -3 server/tools/smoke_test.py "帮我选一台 4000-5000 的拍照手机"
```

预期：依次打印 plan、search、read、sources、compare、结论增量，最后 `status: done`，`sources: 3`。

## 当前进度

- 任务生命周期、SSE、取消、SQLite、事件回放：真实实现。
- 结论生成：已接 **DeepSeek**（`server/.env` 的 `LLM_API_KEY`）；失败自动回退 mock。
- 搜索、读页、对比表：仍是 mock 数据（`MOCK_SOURCES` / `MOCK_PHONES`）。
- 下一步：真实搜索 API + 读页 + 引用。

健康检查会返回 `llm.configured`，但不会返回 Key：

```json
{"data":{"ok":true,"llm":{"configured":true,"model":"deepseek-chat"}}}
```

## 为什么不是 FastAPI

这台机器访问不了 pip 源，FastAPI 装不上；先用标准库把接口和 SSE 跑通。
`/api/v1` 路径、错误结构、事件格式已经按 FastAPI 版本的契约设计，后续平移不改前端。
