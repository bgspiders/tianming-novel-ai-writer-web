# 阶段 7 编辑器 + 向量召回阶段报告

> **完成范围**:阶段 7 MVP — `/editor` 章节编辑器、Markdown 编辑/预览/分屏、加载版本与当前编辑对比、章节内容保存、项目章节列表、当前章节搜索替换、章节辅助相似召回、轻量召回搜索 API 与前端召回面板、轻量索引状态/重建、保存后 stale 状态识别、章节生成 prompt 召回上下文注入、EditorService 轻量召回 sqlite 测试覆盖。
>
> **验证说明**:`dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1`、`npm run type-check`、`npm run build` 作为阶段 7 验证命令。`dotnet test` 在当前沙箱仍受 VSTest 本地 socket 权限限制。

## 一、本轮产出

- 后端 DTO:`EditorSearchRequest`、`EditorSearchResultDto`、`EditorChapterAssistDto`、`EditorSaveChapterRequest`、`EditorIndexStatusDto`、`EditorIndexRebuildRequest`、`EditorIndexRebuildResultDto`。
- 后端服务:`IEditorService` / `EditorService`,提供项目内章节搜索、章节编辑辅助信息、章节正文保存、轻量索引状态读取与重建;`ChapterDraftService` 会在生成 prompt 中注入前文相关章节上下文。
- 后端测试:`EditorServiceTests` 覆盖标题/摘要/正文关键词命中、topK 截断与排序、空 query 返回空结果、章节辅助召回排除当前章节、空索引状态、重建 ready 状态、保存后 stale 状态;`ChapterDraftPromptRecallTests` 覆盖生成 prompt 召回区块、未来章节过滤与长片段截断。
- 后端 API:`POST /api/editor/search`、`GET /api/editor/chapters/{chapterId}`、`PUT /api/editor/chapters/{chapterId}/content`、`GET /api/editor/index/status`、`POST /api/editor/index/rebuild`。
- 前端 API:`frontend/src/api/modules/editor.ts`,封装章节列表、章节辅助读取、编辑器保存、轻量召回搜索、索引状态读取与重建。
- 前端页面:`/editor`,支持按当前 Project / Volume 浏览章节、编辑 Markdown 正文、预览或分屏查看、当前章节搜索/替换、保存内容、查看加载版本与当前版本差异指标、自动展示相似章节、手动搜索项目上下文、插入召回片段、查看并重建轻量索引。
- 导航:主侧栏新增“章节编辑器”入口。

## 二、当前能力

- 编辑器:MVP 使用原生 textarea,不新增前端依赖;Monaco 是后续正式编辑器增强项。
- Markdown:内置轻量渲染,支持标题、列表、粗体、斜体和行内代码;后续可替换为 markdown-it。
- 版本对比:展示加载时版本和当前编辑版本,并给出字符/行数变化;后续可替换为 diff2html。
- 轻量召回:MVP 基于章节标题、摘要、正文内容做本地关键词召回,返回片段、分数和命中词;当前不依赖外部 embedding 网络请求或新 NuGet。测试已覆盖标题/摘要/正文命中、topK、空 query 和相似章节排除当前章节。
- 轻量索引:提供进程内快照状态,返回 `indexedChapterCount`、`totalChapterCount`、`keywordCount`、`lastBuiltAt`、`staleChapterCount`、`status`;保存后可识别旧快照 stale,用户可手动重建。
- 保存:编辑器保存走 `/api/editor/chapters/{chapterId}/content`,复用章节正文文件存储边界,并让阶段 7 的索引状态链路可观测。
- 生成联动:章节生成 prompt 自动追加当前章之前的相关章节上下文,单字段截断 300 字、召回区块总量控制在 2800 字符内;如果与规划冲突,提示模型优先遵守 ChapterPlan / ChapterBlueprint 和用户提示词。

## 三、后续深化

- 接入正式 `ITextEmbedder` async / batch 接口和 `OpenAITextEmbedder`,并按内容 hash 做增量索引;正式向量召回仍属于后续工作,不包含在阶段 7 MVP 完成范围内。
- 评估 sqlite-vec / Qdrant / Kernel Memory 的持久化方案,替换当前关键词轻量召回。
- 在章节保存后异步刷新索引,索引失败只记录状态,不阻断编辑保存;当前 MVP 已支持 stale 识别和手动重建。
- 继续增强章节生成召回策略,从关键词轻量召回升级到正式向量召回,并按模型上下文窗口动态调整 topK 与片段长度。
- 前端替换为 Monaco、markdown-it、diff2html,并补编辑器交互测试。
