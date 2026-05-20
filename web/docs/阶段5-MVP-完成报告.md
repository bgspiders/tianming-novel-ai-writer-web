# 阶段 5 校验模块阶段报告

> **完成范围**:阶段 5 完整 Web 校验模块 — 统一校验入口、ValidationSummary / ValidationReport 持久化、校验批次 RunId、章节修复状态回写、跨模块引用/规划/tracking 规则层、12 维事实快照浏览与 `/validate` 校验工作台。
>
> **验证说明**:`dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1`、`npm run type-check`、`npm run build` 已通过。`dotnet test web/backend/TM.Web.sln --no-build -v:minimal -m:1` 在当前沙箱被 VSTest 本地 socket 权限拦截,报 `SocketException (13): Permission denied`。

## 一、本轮产出

- 后端 `IValidationService` / `ValidationService`:运行校验、列出汇总、列出最新批次章节报告、更新章节状态、聚合事实快照。
- API `ValidationController`:`POST /api/validation/run`、`GET /api/validation/summaries`、`GET /api/validation/reports`、`PUT /api/validation/reports/{reportId}/chapter-status`、`GET /api/validation/facts`。
- 前端 `/validate` 工作台:运行校验、查看汇总/报告/检查项、标记 `needs_fix` / `validated`、浏览事实快照。
- 测试 `ValidationServiceTests`:覆盖校验持久化、非法章节状态、规划/引用/tracking 规则、最新批次报告、事实快照聚合、章节修复状态回写。
- 数据迁移 `20260520073500_AddValidationRunIds`:为 `validation_reports` 增加 `RunId`,为 `validation_summaries` 增加 `LastRunId`。

## 二、事实快照覆盖

当前快照已覆盖阶段 4 门禁相关的 12 维输入/状态视图:

1. 角色状态
2. 角色设定
3. 冲突进度
4. 势力状态
5. 情节点
6. 地点状态
7. 地点设定
8. 世界观硬约束
9. 时间线
10. 角色位置/移动
11. 物品状态
12. 伏笔状态

## 三、规则层覆盖

- 静态一致性:章节标题、状态合法性、正文路径、字数。
- 规划完整性:章节规划、章节蓝图是否存在。
- 引用解析:章节规划/蓝图中的角色、势力、地点必须能匹配设计规则。
- Tracking 回写:剧情节点、时间线、角色移动、伏笔逾期。
- 报告批次:每次运行生成独立 `RunId`,列表默认返回最新批次,避免历史报告污染当前视图。

## 四、仍保留的边界

- 未直接接入 Legacy `UnifiedValidationService`;旧实现依赖 WPF/Guide/旧 AI 上下文较重,当前 Web 侧已实现等价核心规则层。
- 规则仍可继续深化到正文内容语义级 AI 校验,目前主要覆盖数据一致性与生成后事实账本。
- 当前沙箱不能完成 VSTest 执行,需要在允许本地测试 socket 的环境重跑 `dotnet test`。
