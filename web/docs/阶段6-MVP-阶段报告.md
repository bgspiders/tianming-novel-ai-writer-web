# 阶段 6 AI 助手阶段报告

> **完成范围**:阶段 6 MVP+ — Agent / Plan / Edit 三模式会话、模式展示策略、项目上下文召回、对话记忆、流式输出、RunEvent 运行事件、消息摘要/分析块保存、思考块折叠展示、Plan 结构化步骤、章节指令识别、单章/多章计划归一化、显式计划执行入口、只读执行器工具链、执行轨迹/工具调用 payload 契约与展示、`tool.started` / `tool.completed` / `tool.failed` / `tool.cancelled` 事件契约、失败摘要契约、会话设置保存与 `/ai-assistant` 工作台。
>
> **验证说明**:`dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1`、`npm run type-check`、`npm run build` 已通过。`dotnet test` 在当前沙箱被 VSTest 本地 socket 权限拦截。

## 一、本轮产出

- 后端 DTO:`ChatSessionDto`、`ChatMessageDto`、`SendChatMessageRequest`、`SendChatMessageResult`、`ExecuteChatPlanRequest`、`ExecuteChatPlanResult`;消息 DTO 已包含 `summary`、`analysisBlocksJson`。
- 后端服务:`IChatAssistantService` / `ChatAssistantService`,包含多标签 thinking 拆分、Plan 步骤解析、章节指令识别、`ToolPayload` 保存、显式计划执行、只读工具链 trace 回写和运行事件推送。
- 模式展示策略:Web payload 已承载 `targetPanel`、`hideRawContentInBubble`、`analysisExpandedByDefault`、`requiresExecutionEngine`、`description`,对齐旧 Conversation profile 的核心展示契约。
- Prompt 上下文:会话绑定 Project 时自动注入项目、分卷、分卷规划、最近章节、最近章节规划和最近校验结果摘要。
- SignalR:`IGenerationNotifier.EventAsync` / `RunEvent`,推送用户消息保存、提示词准备、助手输出解析、助手消息落库、计划执行开始/完成和工具生命周期事件;`tool.started` / `tool.completed` / `tool.failed` / `tool.cancelled` payload 包含工具记录、状态、参数、结果、耗时和错误信息。
- 后端解析模块:`Services/Chat/Parsing`,迁移 `ChineseNumberParser`、`PlanStepParser`、`PlanStepNormalizer`、`ChapterDirectiveParser`、`ThinkingBlockParser` 的 Web 侧纯逻辑。
- 后端迁移:`AddChatMessageAnalysisFields`,为 `chat_messages` 增加 `Summary`、`AnalysisBlocksJson`。
- 后端 API:`/api/chat-assistant/sessions`、`/api/chat-assistant/sessions/{id}/messages`、`/api/chat-assistant/sessions/{id}/messages/{messageId}/execute`。
- 前端 API:`frontend/src/api/modules/chatAssistant.ts`。
- 前端页面:`/ai-assistant`,支持会话列表、三模式切换、Provider/Key/Model 选择、会话标题/配置保存、SignalR 流式消息、RunEvent 时间线、thinking 折叠、Plan 步骤卡片、显式“执行计划”按钮、章节/指令标签、执行轨迹/工具调用面板和错误常驻提示。
- 导航:主侧栏新增 AI 助手入口。

## 二、当前能力

- `agent`:通用任务拆解和执行建议。
- `plan`:规划、步骤、风险和验收标准;后端会解析 `步骤 1:` / `1.` / `第一步:` / 复杂中文数字等格式并写入 `ToolPayload`。
- Plan 摘要:成功解析时生成“已生成创作计划，共 N 个步骤”摘要,并默认隐藏原始计划正文气泡,由执行计划卡片承载详情。
- `edit`:改写、润色、结构修订和文本编辑。
- 对话记忆:服务端保存 user / assistant 消息,新请求注入最近 16 条历史。
- 项目上下文:会话有 `ProjectId` 时,请求会带入当前工作上下文,避免助手只知道裸 `ProjectId`。
- 运行事件:发送期间显示 `message.saved`、`prompt.ready`、`assistant.parsed`、`message.persisted` 等事件;显式执行计划时显示 `execution.started`、`tool.started`、`tool.completed`、`tool.failed`、`tool.cancelled`、`execution.completed`,并回写 `toolCall` / `executionTrace` / `executionTraceSummary` payload。
- 思考块:模型输出 `<thinking>` / `<think>` / `【思考】` / `[thinking]` 时会拆到 `ThinkingContent`,并按标题/编号拆为 thinking blocks 写入 `AnalysisBlocksJson`。
- 结构化 payload:Plan 模式保存 `type=plan, steps[]`,包含 `targetPanel`、`hideRawContentInBubble`、`analysisExpandedByDefault`、`requiresExecutionEngine`、`description`、`chapterNumber`、`continueFromChapterId`、`rewriteTargetChapterId`、`normalization`、`chapterRange`、`directive`、`executionTrace`、`executionTraceSummary`、`toolCalls`;Agent/Edit 模式可保存 thinking blocks、章节指令和执行面板展示提示。
- 计划执行:用户点击“执行计划”后,后端只读工具链会加载项目上下文、逐步校验章节/续写/重写目标,实时推送工具事件,最终把 trace 和 summary 回写到原助手消息 payload。
- 执行轨迹展示:前端可渲染历史消息 payload 和实时 RunEvent 中的工具调用状态、插件/函数、参数、结果、耗时、错误与汇总信息;失败摘要通过 `failedStepSummaries` 和 `summaryText` 保持稳定展示。
- 计划归一化:单章任务会合并为一个执行步骤;章节范围会拆成逐章步骤;多章计划会保留原步骤。
- 纯逻辑/序列化测试:`ChatParsingTests` 已覆盖 Plan payload、执行轨迹、执行汇总、四类工具生命周期 RunEvent、失败/取消记录和失败摘要文本,不依赖网络、SignalR 或真实执行器运行。

## 三、后续深化

- 接入会写入内容的真实生成/续写/重写工具前,需要增加显式确认、取消、重试和并发互斥,避免 Plan 对话自动修改章节正文。
- 继续迁移旧 `Services/Framework/AI/SemanticKernel/Conversation/` 中 Agent profile 的执行策略、intent 判定与 WriterPlugin 编排;当前 Web 侧展示契约、只读执行器与面板已就绪。
- 为前端助手页面补交互测试。
