# 天命 Web 版

把 WPF 桌面版「天命」迁移为浏览器访问的单用户 Web 应用，支持本地直接运行或 Docker 一键部署。

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | Vue 3.5 + TypeScript 5 + Vite 6 + Pinia 2 + Element Plus 2.8 + Axios + @microsoft/signalr |
| 后端 | ASP.NET Core 8 (net8.0) + SignalR + EF Core 8 + SQLite |
| AI | Microsoft Semantic Kernel 1.73 (OpenAI 兼容 / Anthropic / Gemini) |
| 嵌入 | OpenAI Embeddings 兼容 API（不再用本地 ONNX） |
| 爬虫 | Microsoft.Playwright（替代 WebView2） |
| 部署 | Docker 单镜像（基于 mcr.microsoft.com/playwright/dotnet） |

## 目录结构

```
web/
├── backend/          ASP.NET Core 8 解决方案
│   ├── src/
│   │   ├── TM.Web.Api/             启动入口 + Controllers + Hubs
│   │   ├── TM.Web.Application/     用例 / DTO / 编排
│   │   ├── TM.Web.Domain/          实体接口 / 领域服务接口
│   │   ├── TM.Web.Infrastructure/  EF Core + SQLite + 文件存储
│   │   └── TM.Web.LegacyBridge/    复用原 Services 的桥接层（阶段 1 接入）
│   └── tests/
├── frontend/         Vue 3 + Vite SPA
├── docker/           Dockerfile + docker-compose.yml
└── docs/             迁移路线图 / 复用清单 / 数据模型映射等
```

## 端口约定

| 用途 | 端口 |
|------|------|
| 后端 API + SignalR | 38721 |
| 前端 Vite Dev Server | 38720 |
| Docker 暴露 | 38721 |

## 快速启动（开发模式）

### 前置依赖

- .NET 8 SDK（macOS: 去 <https://dotnet.microsoft.com/zh-cn/download/dotnet/8.0> 下载 .pkg）
- Node.js 20+

### 启动后端

```bash
cd web/backend
dotnet restore
dotnet run --project src/TM.Web.Api
```

打开 <http://localhost:38721/swagger> 看到 Swagger 即成功。

### 启动前端（另开终端）

```bash
cd web/frontend
npm install
npm run dev
```

打开 <http://localhost:38720> 即可使用。前端通过 Vite 代理把 `/api` 与 `/hubs` 转发到后端 38721。

## Docker 部署

### 前置依赖

- Docker Desktop / Docker Engine 24+
- Docker Compose v2

### 启动

```bash
cd web/docker
docker compose up -d --build
```

访问 <http://localhost:38721> 即可。数据持久化在宿主机 `./data/Storage`。

### 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

健康检查地址：<http://localhost:38721/api/health>。

## 当前进度

本目录是阶段 0 的产物（骨架 + 端到端 AI 流式 Demo）。完整迁移路线图见 [docs/迁移路线图.md](docs/迁移路线图.md)。

## 许可证

跟随项目根目录 LICENSE（MIT）。
