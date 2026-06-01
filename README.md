# 天命 Web 版

天命 Web 版是基于原项目 [zy-zmc/tianming-novel-ai-writer](https://github.com/zy-zmc/tianming-novel-ai-writer) 进行二次开发的 Web 版本，从原 WPF 桌面版迁移为单用户浏览器应用。当前分支已经将 Web 项目提升到仓库根目录，后端、前端、Docker 与文档都以根目录作为项目入口。

## 项目来源

- 原作者项目：[zy-zmc/tianming-novel-ai-writer](https://github.com/zy-zmc/tianming-novel-ai-writer)
- 当前项目：在原项目基础上进行 Web 化迁移、后端服务化、前端重构、Docker 部署与生成流程增强。
- 版权与许可证：请同时遵守原项目许可证及本仓库许可证说明。

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | Vue 3.5 + TypeScript 5 + Vite 6 + Pinia 2 + Element Plus 2.8 + Axios + SignalR |
| 后端 | ASP.NET Core 8 + SignalR + EF Core 8 + SQLite |
| AI | Microsoft Semantic Kernel + OpenAI 兼容接口 |
| 爬虫 | Microsoft.Playwright |
| 部署 | 本地开发模式 / Docker Compose |

## 目录结构

```text
.
├── backend/          ASP.NET Core 8 解决方案
│   ├── src/
│   │   ├── TM.Web.Api/             启动入口、Controllers、Hubs
│   │   ├── TM.Web.Application/     DTO、应用服务接口、AI 编排
│   │   ├── TM.Web.Domain/          领域实体
│   │   ├── TM.Web.Infrastructure/  EF Core、SQLite、文件存储、业务服务
│   │   └── TM.Web.LegacyBridge/    Web 兼容层
│   └── tests/
├── frontend/         Vue 3 + Vite SPA
├── docker/           Dockerfile + docker-compose.yml
└── docs/             迁移路线图、数据模型、阶段报告
```

## 端口

| 用途 | 端口 |
|------|------|
| 后端 API + SignalR | 38721 |
| 前端 Vite Dev Server | 38720 |
| Docker Web 入口 | 38721 |

## 本地开发启动

### 环境要求

- .NET 8 SDK
- Node.js 20+
- npm

### 启动后端

```bash
cd backend
dotnet restore
dotnet run --project src/TM.Web.Api
```

后端启动后访问：

```text
http://localhost:38721/swagger
```

如果只看到 `wwwroot` 不存在的警告，可以忽略；开发模式下前端由 Vite 单独提供。

### 启动前端

另开一个终端：

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:38720
```

Vite 会把 `/api` 和 `/hubs` 代理到后端 `http://localhost:38721`。

## Docker 部署

### 启动

```bash
cd docker
docker compose up -d --build
```

访问：

```text
http://localhost:38721
```

### 数据目录

Docker 部署默认把运行数据挂载到：

```text
docker/data/Storage
```

SQLite 数据库、章节文件、上传文件等运行数据都应放在持久化目录中。生产环境备份时优先备份该目录。

### 常用命令

```bash
# 查看日志
cd docker
docker compose logs -f

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

健康检查：

```text
http://localhost:38721/api/health
```

## 代理配置

后端支持为 AI 出站请求配置 HTTP/HTTPS 代理。配置文件位置：

```text
backend/src/TM.Web.Api/appsettings.json
```

示例：

```json
"HttpProxy": {
  "Url": "http://127.0.0.1:7890",
  "Username": "",
  "Password": "",
  "BypassOnLocal": false,
  "BypassList": []
}
```

说明：

- `Url` 为空时不启用代理。
- `Username` / `Password` 可选。
- 如果代理账号密码已经写在 `Url` 中，后端会自动解析。
- macOS 下 AI 出站客户端会关闭证书吊销检查，避免部分 OpenAI 兼容接口在 .NET 中握手失败。

## 基本操作流程

### 1. 配置 AI

1. 打开 AI 配置页面。
2. 新增 Provider 或选择已有配置。
3. 填写 OpenAI 兼容接口地址、模型名、API Key。
4. 使用测试功能确认模型可以正常返回。

常见接口地址示例：

```text
https://api.openai.com/v1
https://api.deepseek.com/v1
```

如果只填写根域名，后端会自动补齐 `/v1`。

### 2. 创建项目与分卷

1. 在项目区域创建小说项目。
2. 创建分卷。
3. 进入章节生成页面，确认左侧工作上下文已经选中项目和分卷。

### 3. 录入规划数据

建议先补齐这些数据，再生成正文：

- 大纲
- 卷设计
- 章节规划
- 章节蓝图
- 角色规则
- 地点规则
- 势力规则
- 世界规则

生成服务会自动召回章节规划、蓝图和相关前文作为上下文。

### 4. 生成章节

1. 选择章节。
2. 选择 AI 配置或临时填写 API Key。
3. 填写系统提示词和 Prompt。
4. 设置温度、最大 Tokens、最大重写次数。
5. 点击生成。

推荐 4000 中文字章节设置：

```text
温度：0.75 - 0.85
最大 Tokens：7000 - 9000
最大重写次数：0 - 1
```

Prompt 建议明确写：

```text
请直接输出约 4000 个中文字符的完整章节正文，叙事完整，不要摘要，不要分点。
请使用自然小说段落排版：每段 3-6 句，段落之间只使用一个换行，不要一句一段。
```

如果模型在长文本中途断开，页面会保留已经流式返回的正文。可以降低最大 Tokens 或分段生成。

### 5. 校验与修订

生成后可以运行校验：

1. 进入校验页面。
2. 选择项目或分卷运行校验。
3. 查看角色、地点、势力、情节连续性问题。
4. 回到章节生成页，带着校验修正上下文重新生成或手动修订。

### 6. 编辑与版本

章节正文可以在编辑器中继续修改。保存内容时会更新章节字数和状态；如果启用了版本功能，可以查看或恢复历史版本。

## 生成相关说明

- `最大 Tokens` 是模型输出上限，不等于中文字数。
- 4000 中文字通常建议给 7000-9000 tokens。
- 如果模型本身最大输出只有 4096 tokens，前端填更高也不会生效。
- `预计字数` 只会写入 Prompt，不会作为硬性截断。
- 自动召回上下文有长度上限，用于避免 Prompt 过长。
- 长流式输出依赖模型服务和代理稳定性，断流通常不是前端错误。

## 常见问题

### The WebRootPath was not found

开发模式下可以忽略。前端由 Vite 提供，后端不需要 `wwwroot`。

### An error occurred while sending the request

表示 AI 上游请求发送失败或流式生成中途断开。检查：

- Endpoint 是否正确。
- API Key 是否可用。
- 代理是否连通。
- 模型是否支持当前最大 Tokens。
- 是否生成文本过长导致上游断流。

### 生成门禁未通过

门禁会检查章节是否覆盖规划中的角色、势力、地点和关键情节。若误判，优先检查章节规划和蓝图字段是否写入了多余引号、括号或格式符号。

## 开发检查

```bash
# 后端构建
dotnet build backend/src/TM.Web.Api/TM.Web.Api.csproj

# 前端类型检查
cd frontend
npm run typecheck
```

## 许可证

MIT
