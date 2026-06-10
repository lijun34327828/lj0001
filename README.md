# 资产与预算管理系统

前后端分离架构，本地隔离部署，数据与日志独立分区。

## 技术栈

- **后端**: Node.js + Express + SQLite + JWT
- **前端**: Vue 3 + Vite + ECharts + Element Plus
- **端口**: 后端 8631

## 目录结构

```
.
├── server/          # 后端服务
│   ├── data/        # 数据分区（独立）
│   ├── logs/        # 日志分区（独立）
│   ├── src/         # 源码
│   └── package.json
├── web/             # 前端应用
│   ├── src/
│   └── package.json
└── package.json
```

## 启动方式

```bash
# 安装依赖
npm run install:all

# 启动后端
npm run dev:server

# 启动前端
npm run dev:web
```
