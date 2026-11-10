# 拾页 · AI 互联网助手

> 搜得清楚，存得下来，找得回去。

拾页是一个帮用户「用互联网完成一件事」的 Web 助手：说一个目标，它去几个网站查、读、比，把证据和结论交回来；看过的页面可以收藏，之后按意思找回来；每周整理成一份个人回顾。

## 当前状态

| 模块 | 状态 |
| --- | --- |
| 工作台 | 已接任务 API + SSE，结论由 DeepSeek 真实生成 |
| 收藏 | 前端演示：搜索、过滤、卡片、删除 |
| 周报 | 前端演示：五段结构、导出 Markdown、打印/PDF |
| 设置 | 前端演示：模型、搜索源、数据、关于 |
| 搜索/读页/引用 | 仍为 mock 数据，下一步接真实搜索 |
| 浏览器扩展 | 未开始 |

> 这是比赛早期的可运行原型，不是最终版。计划书、内部会议记录等材料不在本仓库。

## 快速启动

需要 Python 3.11+。

### 1. 启动后端

```bat
cd server
copy .env.example .env
notepad .env
```

在 `.env` 填：

```dotenv
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-你的key
LLM_MODEL=deepseek-chat
```

然后：

```bat
py -3 app.py --port 8000
```

健康检查：http://127.0.0.1:8000/api/v1/health

### 2. 启动前端

```bat
cd app
py -3 -m http.server 5180 --bind 127.0.0.1
```

打开 http://127.0.0.1:5180

> 前端当前使用预编译的 `app/dist/main.js` + 本地 Vue ESM，不依赖 npm 安装；修改 `src/main.ts` 后需要重新编译（见 `app/README.md`）。

## 目录

```text
app/                Vue 3 + TypeScript 前端
  src/main.ts       页面、组件、SSE 客户端
  dist/main.js      编译产物（当前预览用）
  vendor/vue/       本地 Vue ESM 运行时
server/             Python 标准库任务 API
  app.py            任务、SQLite、SSE、mock 搜索/读页
  llm.py            DeepSeek / OpenAI 兼容客户端
docs/               （不包含计划书与内部材料）
```

## 技术栈

- 前端：Vue 3 + TypeScript，SSE 流式渲染，自定义设计系统
- 后端：Python 标准库 HTTP + SQLite + SSE
- 模型：DeepSeek / OpenAI 兼容接口
- 下一步：真实搜索 API、读页、引用、RAG、浏览器扩展

## 已知限制

- 搜索来源和手机参数是 mock，结论中的引用对应 mock 来源。
- 收藏/周报暂未落后端，刷新会重置。
- 未安装 Vite 依赖，当前是离线可跑的过渡方案。
