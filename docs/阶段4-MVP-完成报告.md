# 阶段 4 生成模块阶段报告

> **完成范围**:阶段 4 正式范围 — Project / Volume / Chapter 元数据闭环、`/generate/*` 工作台、章节草稿流式生成、服务端保存正文、GenerationRecord / GenerationStatistics 记录、GenerationProgressHub 到 IGenerationNotifier 的 Web 适配、`GenerationGate` 六道门禁、完整 12 维事实快照输入、`ParsedChanges` 状态回写、有限多轮重写链路与 `/generate/gate` 门禁交互。
>
> **验证说明**:代码侧已补齐正式范围闭环；`dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1`、`npm run type-check`、`npm run build` 已通过。`dotnet test` 在当前沙箱仍受 MSBuild 本地 IPC 权限限制，无法完成测试运行。

## 一、本轮产出

### 1.1 后端章节基础
- [Application/Dtos/Core/ChapterDto.cs](../backend/src/TM.Web.Application/Dtos/Core/ChapterDto.cs) — `ChapterDto` / `ChapterUpsertDto`
- [Application/Services/IChapterService.cs](../backend/src/TM.Web.Application/Services/IChapterService.cs) — `IChapterService` + `IChapterDraftService`
- [Infrastructure/Services/Core/ChapterService.cs](../backend/src/TM.Web.Infrastructure/Services/Core/ChapterService.cs) — 章节 CRUD、章节号唯一校验、正文文件读写、字数统计
- [Api/Controllers/ChaptersController.cs](../backend/src/TM.Web.Api/Controllers/ChaptersController.cs) — `/api/chapters` + `/api/chapters/{id}/content`

### 1.2 后端生成入口
- [Application/Dtos/Generate/ChapterDraftDto.cs](../backend/src/TM.Web.Application/Dtos/Generate/ChapterDraftDto.cs) — `ChapterDraftRequest` / `ChapterDraftResult`
- [Application/Dtos/Generate/GenerationGateDto.cs](../backend/src/TM.Web.Application/Dtos/Generate/GenerationGateDto.cs) — Web 侧门禁请求 / 事实快照 / 门禁结果 DTO
- [Application/Dtos/Generate/GenerationRecordDto.cs](../backend/src/TM.Web.Application/Dtos/Generate/GenerationRecordDto.cs) — 生成记录 / 统计 DTO
- [Application/Services/IGenerationGateService.cs](../backend/src/TM.Web.Application/Services/IGenerationGateService.cs) — 生成门禁适配接口
- [Application/Services/AiCompletionService.cs](../backend/src/TM.Web.Application/Services/AiCompletionService.cs) — 流式推送同时累计完整正文
- [Infrastructure/Services/Generation/GenerationStateService.cs](../backend/src/TM.Web.Infrastructure/Services/Generation/GenerationStateService.cs) — 从设计表 + tracking 表组装 12 维事实快照,并把通过门禁后的 `ParsedChangesJson` 回写角色、冲突、伏笔、剧情节点、地点、势力、时间线、移动与物品状态
- [Infrastructure/Services/Generation/ChapterDraftService.cs](../backend/src/TM.Web.Infrastructure/Services/Generation/ChapterDraftService.cs) — 复用 `IAiCompletionService.StreamAsync()` 推流,服务端自动召回 ChapterPlan / ChapterBlueprint 规划上下文注入 Prompt;生成后调用门禁;门禁失败进入有限重写,通过后保存正文、回写事实状态并写入 `GenerationRecord`
- [Api/Controllers/GenerationController.cs](../backend/src/TM.Web.Api/Controllers/GenerationController.cs) — `POST /api/generation/chapter-draft`、`GET /api/generation/records`、`GET /api/generation/statistics`
- [Api/Program.cs](../backend/src/TM.Web.Api/Program.cs) — 注册 `IChapterService`、`IChapterDraftService`、`IGenerationGateService`

### 1.3 LegacyBridge 进度桥
- [Services/Framework/AI/SemanticKernel/GenerationProgressHub.cs](../../Services/Framework/AI/SemanticKernel/GenerationProgressHub.cs) — 保留静态 `Report(string)`,新增 `IProgressSink` + `AsyncLocal<RunId>`
- [LegacyBridge/Compatibility/GenerationProgressHubAdapter.cs](../backend/src/TM.Web.LegacyBridge/Compatibility/GenerationProgressHubAdapter.cs) — 通过 `IGenerationNotifier.StatusAsync(...)` 转发到 SignalR
- [LegacyBridge/Generation/LegacyGenerationGateService.cs](../backend/src/TM.Web.LegacyBridge/Generation/LegacyGenerationGateService.cs) — 包装原 `GenerationGate.ValidateAsync(...)`,把 Web DTO 转为老业务模型并回传门禁结果
- [LegacyBridge/TM.Web.LegacyBridge.csproj](../backend/src/TM.Web.LegacyBridge/TM.Web.LegacyBridge.csproj) — 源码包含 `GenerationProgressHub.cs` 与 `GenerationGate` 最小依赖闭包,不冒进拉入整个 `Services/**`

### 1.4 前端生成工作台
- [frontend/src/api/modules/chapters.ts](../frontend/src/api/modules/chapters.ts) — 章节 CRUD、正文保存、草稿生成 API,支持 `maxRewriteAttempts`
- [frontend/src/api/modules/generation.ts](../frontend/src/api/modules/generation.ts) — 生成记录 / 统计 API
- [frontend/src/views/generate/GenerationWorkbenchView.vue](../frontend/src/views/generate/GenerationWorkbenchView.vue) — `/generate` 总工作台
- [frontend/src/views/generate/ChapterGenerationView.vue](../frontend/src/views/generate/ChapterGenerationView.vue) — 章节列表、新建章节、提示词编辑、门禁重写次数、SignalR 流式输出、服务端保存草稿
- [frontend/src/views/generate/GenerationGateView.vue](../frontend/src/views/generate/GenerationGateView.vue) — `/generate/gate` 结构化展示生成记录、门禁阶段、每次尝试、失败摘要与原始 attempts JSON
- [frontend/src/router/index.ts](../frontend/src/router/index.ts) — `/generate/outlines`、`/generate/volume_designs`、`/generate/chapter_plans`、`/generate/chapter_blueprints`、`/generate/chapters`、`/generate/gate`
- [frontend/src/layouts/MainLayout.vue](../frontend/src/layouts/MainLayout.vue) — 左侧菜单新增完整"生成模块"

## 二、已验证项

| 项 | 状态 | 验证方式 |
|----|------|---------|
| 前端类型检查 | 通过 | `npm run type-check` / `vue-tsc --noEmit` 退出码 0 |
| 前端生产构建 | 通过 | `npm run build` 退出码 0,产物包含 `GenerationWorkbenchView-*.js`、`GenerationGateView-*.js`、`ChapterGenerationView-*.js` |
| 后端 SDK 探测 | 历史通过 | 当前环境有 .NET SDK 8.0.421 |
| 后端 build | 通过 | `dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1` 退出码 0，0 warning / 0 error |
| 后端测试运行 | 环境受限 | `dotnet test web/backend/TM.Web.sln --no-build -v:minimal` 在当前沙箱创建 MSBuild 本地 pipe/socket 时报 `Permission denied`，提权审批系统 403 拒绝 |
| 生成路由覆盖 | 通过 | 前端构建解析了 `/generate`、`/generate/*` 动态 import,构建产物已生成 |
| 服务端生成闭环 | 静态完成 | `ChapterDraftService` 已校验 Project/Volume/Chapter 归属,AI 成功后跑 `GenerationGate`;门禁失败最多按 `maxRewriteAttempts` 重写,通过后保存去掉 CHANGES 段的正文、写 `GenerationRecord`、累加 `GenerationStatistics`;AI 调用失败记录 `ai_stream`,门禁失败记录真实门禁阶段 |
| 12 维事实快照 | 静态完成 | `GenerationStateService` 从设计表、章节规划、蓝图与 tracking 表组装角色状态、角色位置、角色外貌、冲突、伏笔、剧情节点、地点状态、势力状态、时间线、物品状态、世界观硬约束、地点特征 |
| ParsedChanges 状态回写 | 静态完成 | 门禁通过后解析 `ParsedChangesJson`,写回角色状态/关系、冲突进度、伏笔状态、剧情节点、地点状态、势力状态、时间推进、角色移动、物品流转 |
| 前端门禁交互 | 静态完成 | 章节生成页可设置重写次数,`/generate/gate` 可结构化查看门禁阶段、每次尝试、失败摘要与原始 attempts JSON |

## 三、当前生成流程

1. 顶栏选择 Project / Volume。
2. 进入 `/generate/chapters`。
3. 新建章节:写入 `chapters` 表,状态默认为 `planned`。
4. 填写 Endpoint / API Key / Model 与章节提示词。
5. 前端加入 SignalR run group,调用 `POST /api/generation/chapter-draft`。
6. 后端按当前 Project 的 SourceBook scope 自动召回当前章节的 ChapterPlan 与 ChapterBlueprint,拼接到用户提示词前。
7. 后端通过 `IAiCompletionService` 调 OpenAI 兼容模型,token 通过 SignalR 推回页面。
8. `IAiCompletionService` 同步累计完整正文,`GenerationStateService` 从当前 Project 的 SourceBook、章节规划、蓝图与 tracking 表组装 12 维事实快照。
9. `IGenerationGateService` 调用 LegacyBridge 中的 `GenerationGate.ValidateAsync(...)`;失败时根据 `maxRewriteAttempts` 生成修正提示词并重写。
10. 多次尝试均失败时不保存正文,`GenerationRecord.FailureStages` 写入真实门禁阶段,`Attempts` 写入每次尝试的门禁详情。
11. 门禁通过后保存 `ContentWithoutChanges` 正文到 `Storage/projects/{projectId}/chapters/{chapterId}.md`,状态更新为 `drafted`。
12. `GenerationStateService` 解析 `ParsedChangesJson`,回写 12 维事实状态,让下一章读取最新状态。
13. `GenerationRecord` 记录 runId/model/chunks/chars/elapsed/saved/gate,`GenerationStatistics` 累加项目级统计。
14. `/generate/gate` 可查看当前 Project 下最近生成记录、门禁阶段、重写次数、失败摘要与 attempts JSON。

## 四、明确未做

- ✅ **GenerationProgressHub 注入式推送**:已接线到 `IGenerationNotifier`,LegacyBridge 保留静态 `GenerationProgressHub.Report(...)` 兼容入口。
- ✅ **GenerationGate 六道门禁**:已通过 `IGenerationGateService` 接到 `POST /api/generation/chapter-draft`;AI 输出必须通过协议解析、一致性、未知实体、描写一致性、世界观硬约束、设计元素出场检查后才保存正文。
- ✅ **12 维事实快照输入**:已从 Web 设计表、章节规划/蓝图与 tracking 表组装完整门禁输入。
- ✅ **ParsedChanges 状态回写**:已在门禁通过后写回 tracking 表,支撑下一章读取最新状态。
- ✅ **多轮重写链路**:已支持 `maxRewriteAttempts`,失败后自动带门禁错误和上一版正文重写。
- ✅ **前端门禁交互**:章节生成页支持重写次数,门禁页结构化展示阶段、尝试和失败摘要。
- ✅ **服务端保存流式正文**:已由 `ChapterDraftService` 保存,前端只展示流式内容与手动二次编辑。
- ✅ **GenerationRecord 基础记录**:已写入 success/attempts/failureStages;AI 调用失败为 `ai_stream`,门禁失败为真实门禁阶段,成功记录 gate 摘要。
- ✅ **章节规划/蓝图自动拼接上下文**:`ChapterDraftService` 已按 Project 当前 SourceBook scope 自动召回匹配章节号的 ChapterPlan 与当前 ChapterId 的 ChapterBlueprint,注入首轮与重写 Prompt。
- ✅ **后端真实构建验证**:`dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1` 已通过。
- ❌ **后端测试运行验证**:当前沙箱运行 `dotnet test` 仍被 MSBuild 本地 IPC 权限限制拦截。

## 五、下一步建议

### 选项 A:GenerationGate 端到端验证
1. 在允许 MSBuild/VSTest 本地 IPC 的环境运行 `dotnet test web/backend/TM.Web.sln --no-build -v:minimal`。
2. 用一章包含完整 `---CHANGES---` 的生成结果做端到端验证:生成、规划上下文注入、门禁、重写、正文保存、状态回写、`/generate/gate` 展示。
3. 根据真实样例微调回写字段映射,尤其是 ShortId 与显示名的映射策略。

### 选项 B:提示词上下文增强
1. 把角色/势力/地点引用 picker 的完整规则摘要纳入 Prompt 上下文。
2. 增加 Prompt 预览接口,让前端可查看服务端最终注入后的 Prompt。

> 最后更新:2026-05-20,阶段 4 生成模块推进至正式范围代码闭环,后端 build 与前端构建已通过,待可用测试运行环境做端到端验证。
