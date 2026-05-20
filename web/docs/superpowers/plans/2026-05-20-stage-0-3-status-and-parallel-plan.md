# 阶段 0/1/2/3 最终完成/缺失对照表 + 并行开发计划

> 口径：按 `web/docs/迁移路线图.md` 的正式范围对照当前仓库实现。  
> 结论：阶段 0、2 已正式完成；阶段 3 的 Web 功能与体验收口已基本完成；阶段 1 仍只完成 LegacyBridge 安全子树接入，严格路线图的全量 `Services/**` 接入仍未完成。

## 一、对照表

| 阶段 | 路线图正式范围 | 当前仓库状态 | 仍缺的部分 |
|---|---|---|---|
| 阶段 0 | 骨架、端到端 AI 流式切片、基础前后端可运行 | 已完成 | 无 |
| 阶段 1 | EF Core 数据层、数据导入、LegacyBridge 全量接入、不可移植文件清理、`StoragePathHelper` 可注入化 | 数据层、导入工具、`StoragePathHelper.SetBasePath`、ProjectData 安全子树源码包含与生成门禁接入已落地，后端 build 通过 | 严格路线图要求的全量 `Services/**` 源码包含仍未完成；全量接入会牵出 WPF/UI、桌面集成、NAudio/System.Speech、SemanticKernel/KernelMemory、旧 `TM.Modules.*` 命名空间、静态 `ServiceLocator` 服务网和桌面单进程项目状态，需要继续按模块拆解 |
| 阶段 2 | Provider / Model / API Key CRUD、Key 测试、多 Key 轮换、前端模型管理页 | 已完成 | 无 |
| 阶段 3 | 设计模块 CRUD、树形分类、引用查询、前端 `/design/*`、复用 `Modules/Design` 通过 LegacyBridge | Web 功能已闭环：11 个模块 CRUD、分类树、引用 picker、Project/Volume 上下文、分页筛选、分类拖拽排序、Markdown 轻量编辑、Project 默认源书读写强制 scope、失效引用清理/重新匹配已上线 | 严格按路线图口径复用原 `Modules/Design` 的 LegacyBridge 接入未完成；当前是 Web 端 `Infrastructure.Services.Design` 绿地实现 |

## 二、我建议的并行开发计划

### 线 A: 阶段 1 严格收口
- 目标：把 `LegacyBridge` 从“能编译的兼容壳”推进到“正式源码接入”。
- 当前状态：已接入 `Services/Modules/ProjectData/**` 安全子树、`GenerationProgressHub` 与 Framework/Common 必要子集；`TM.Web.LegacyBridge.csproj` 当前用 19 条 `<Compile Remove>` 排除 ProjectData 内生成、索引、上下文、打包、跟踪、校验等运行态重依赖文件。
- 复查结论：全量 `Services/**` 暂不放开是正确收口；一次性 Include 会同时拉入 WPF/WindowsDesktop UI、Windows 通知/托盘/NAudio、`Microsoft.SemanticKernel.*` / `Microsoft.KernelMemory.*`、`TM.Modules.Generate/Design/AIAssistant.*` 旧模块命名空间、静态 `ServiceLocator.Get<T>()` 服务网，以及 `StoragePathHelper.CurrentProjectName`/缓存事件等桌面单进程状态。
- 后续交付：继续按模块扩大 `<Compile Include>`，补齐必要 `<Compile Remove>` 与 Web stub；每移除一个 ProjectData Remove 文件，先明确 Web DI adapter、scope 边界和持久化责任，再做 LegacyBridge build 验证。
- 完成标志：阶段 1 的正式范围不再有结构性缺口；短期完成口径是“已接入旧源码均有清晰边界，未接入全量服务按阻塞类别拆分并可逐项收敛”。

### 线 B: 阶段 3 严格收口
- 目标：把设计模块从“可用”推进到“严格契约一致”。
- 当前状态：分类拖拽排序、分页/复杂筛选、Project 默认源书强制 scope、Markdown 轻量编辑、引用修复动作已完成。
- 剩余口径：如果必须严格复用原 `Modules/Design` Service，则需要并入线 A 的 LegacyBridge 扩展，而不是继续扩 Web 端绿地服务。
- 完成标志：`/design/*` 的体验与数据约束和路线图一致。

### 线 C: 阶段 5 校验模块
- 目标：在阶段 4 已有基础上，补上统一校验、报告、事实快照浏览。
- 已完成：后端校验服务、报告持久化、前端 `/validate` 工作台、事实快照概览、Tracking 摘要、时间线、卷事实归档。
- 新增闭环：校验报告带出当前章节状态，前端报告行可把章节标记为 `needs_fix` / `validated`，后端通过 `/api/validation/reports/{reportId}/chapter-status` 回写章节状态。
- 完成标志：能对阶段 4 生成链路做独立校验、回看，并把章节修复状态回写到章节元数据。

## 三、推荐执行顺序

1. 先并行开 `A + B + C`，这三条线依赖最少，互相不抢同一批文件。
2. `A` 和 `C` 可以同时推进，`B` 主要是前后端设计层收口。
3. 阶段 4 生成链路先不要改，避免把已经稳定的门禁/重写链路带回归。

## 四、当前最小结论

- 阶段 0: 已正式完成。
- 阶段 1: 数据层完成，ProjectData 安全子树已接入，但 LegacyBridge 全量 `Services/**` 严格口径未收口。
- 阶段 2: 已正式完成。
- 阶段 3: Web 功能与约束基本完成，仅剩“复用原 `Modules/Design` Service”的严格口径缺口。
