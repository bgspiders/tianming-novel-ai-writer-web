# LegacyBridge

> 桥接原 WPF 项目的 `Services/` 与必要 `Framework/Common` 源码到 Web 后端。  
> 当前状态：已接入 ProjectData 安全子树、`GenerationProgressHub` 与必要 Framework/Common 子集；未放开全量 `Services/**`。  
> 严格路线图的全量源码接入仍需继续按模块拆解。

## 已就位的兼容层

| 类 / 命名空间 | 作用 | 文件 |
|---|---|---|
| `TM.App.Log(string)` | 替代原全局日志，转发到 ILogger | `Compatibility/TM_App.cs` |
| `TM.Framework.UI.GlobalToast` | 替代 WPF 弹窗，转发到 ILogger | `Compatibility/GlobalToast.cs` |
| `LegacyLogBridge.Wire(serviceProvider)` | 启动期把 ILogger 注入静态替身 | `Compatibility/LegacyLogBridge.cs` |
| `GenerationProgressHubAdapter.Wire(...)` | 把原静态进度上报转为 `IGenerationNotifier` | `Compatibility/GenerationProgressHubAdapter.cs` |
| `LayeredContextConfig` | Web 兼容版分层上下文参数 | `Compatibility/LayeredContextConfig.cs` |
| `ProjectDataCompatibility` / `LegacyGlobalUsings` | ProjectData 安全子树编译兼容补丁 | `Compatibility/ProjectDataCompatibility.cs` |

## 启动期接线

```csharp
LegacyLogBridge.Wire(app.Services);
GenerationProgressHubAdapter.Wire(app.Services.GetRequiredService<IGenerationNotifier>());
TM.Framework.Common.Helpers.Storage.StoragePathHelper.SetBasePath(
    DbServiceCollectionExtensions.ResolveStorageRoot(builder.Configuration));
```

## 当前已源码包含

- `Framework/Common/Models/**`
- `Framework/Common/Helpers` 中实体名、章节解析、短 ID、JSON、StoragePathHelper 等安全子集
- `Framework/Common/Services/ServiceLocator` 与 StoragePathHelper factory 子集
- `Services/Framework/AI/SemanticKernel/GenerationProgressHub.cs`
- `Services/Modules/ProjectData/**` 安全子树

## 当前 Compile Remove 主要类别

- 生成正文执行链路中依赖完整 GuideContext / AI 回调的类：`ContentPolisher`、`ContentGenerationCallback`、`GeneratedContentService`
- 索引与打包发布链路：`DataIndexService`、`PackageHistoryService`、`PublishService`
- 桌面导航/模块启用状态链路：`NavigationConfigParser`、`ChangeDetectionService`、`ModuleEnabledService`
- 完整上下文构建链路：`GuideContextService`、`ContextService`、`FocusContextService`
- 追踪/校验旧实现中依赖完整上下文的类：`FactSnapshotExtractor`、`CharacterStateService`、`UnifiedValidationService`、`ValidationReportService`、`ValidationSummaryService`

## 全量 `Services/**` 仍阻塞的原因

- WPF/UI 命名空间：`TM.Framework.UI.*`、Workspace、UI message item 等需要 Web 替身或重构。
- 桌面集成：托盘、Toast、通知、语音、系统集成类依赖 Windows 桌面 API。
- AI 对话/UI 耦合：部分 SemanticKernel 服务仍绑定 WPF 消息模型和原应用全局状态。
- GuideContext 完整链路：依赖打包、索引、导航、追踪、MD 文件布局等旧运行态，需要逐模块迁移。
- Modules/Design 严格复用：当前 Web 端设计模块是 `Infrastructure.Services.Design` 绿地实现，若严格复用原 `Modules/Design` Service，需继续扩 LegacyBridge。

## 后续推荐顺序

1. 优先把 `Services/Framework/AI/SemanticKernel/Conversation/**` 独立接入，支撑阶段 6 AI 助手。
2. 再拆 `Modules/Design` 旧 Service，替换当前 Web 端绿地实现或做 adapter 对齐。
3. 最后处理完整 GuideContext / Validation 旧链路，避免一次性全量引入造成不可控编译爆炸。
