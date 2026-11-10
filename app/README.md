# 拾页 · 前端

Vue 3 + TypeScript 的工作台前端。当前包含：

- 工作台：任务、SSE 进度、对比与结论、来源
- 收藏：语义搜索框、收藏卡片、删除
- 周报：五段结构、导出 Markdown、打印/PDF
- 设置：模型、搜索源、数据、关于
- 每日灵感：可切换
- 后端不在线时自动降级为本地演示

## 本地预览

```bat
预览.bat
```

或：

```bat
py -3 -m http.server 5180 --bind 127.0.0.1
```

打开 http://127.0.0.1:5180

后端（可选）：`py -3 server/app.py --port 8000`

## 目录

```
app/
  index.html          # 入口 + Vue import map
  style.css           # 设计 token 与页面样式
  src/main.ts         # 组件、页面、API/SSE、演示数据
  vendor/             # 离线 Vue 运行时与 TypeScript
  dist/main.js        # tsc 编译产物
```

## 改完代码后

```bat
node vendor\typescript\lib\tsc.js -p tsconfig.json
```

## 说明

当前机器访问不了 npm 源，Vite 依赖装不上，所以先用「本地 Vue ESM + tsc」跑预览；
页面代码仍是 Vue 3 + TypeScript，联网后可以切回 Vite + SFC，不需要重写界面。
