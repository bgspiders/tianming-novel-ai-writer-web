# LegacyBridge

> 桥接原 WPF 项目的 `Services/` 与 `Modules/*/Services/` 源码到 Web 后端。
> 阶段 0/1：仅提供兼容层 stub（GlobalToast/TM.App.Log 等替身类），**未实际 `<Compile Include>` 原源码**。
> 阶段 1.5 后半段（下次会话）：按模块逐步拉入 Services 源码。

## 已就位的兼容 stub

| 类 / 命名空间 | 作用 | 文件 |
|--------------|------|------|
| `TM.App.Log(string)` | 替代原 `Core/App/App.xaml.cs` 的全局日志 → 转发 ILogger | [Compatibility/TM_App.cs](Compatibility/TM_App.cs) |
| `TM.Framework.UI.GlobalToast` | 替代 WPF 弹窗 → 转发 ILogger | [Compatibility/GlobalToast.cs](Compatibility/GlobalToast.cs) |
| `LegacyLogBridge.Wire(serviceProvider)` | 启动期把 ILogger 注入到上述静态替身 | [Compatibility/LegacyLogBridge.cs](Compatibility/LegacyLogBridge.cs) |

## 启动期接线

在 `Program.cs` `app.Run()` 之前加：

```csharp
TM.Web.LegacyBridge.Compatibility.LegacyLogBridge.Wire(app.Services);
TM.Framework.Common.Helpers.Storage.StoragePathHelper.SetBasePath(
    TM.Web.Infrastructure.Persistence.DbServiceCollectionExtensions.ResolveStorageRoot(builder.Configuration));
```

第二行让原 Services 的所有路径方法基于新的 Storage:RootPath。

## 下次会话要做的事

1. 修改 `TM.Web.LegacyBridge.csproj` 加 `<Compile Include="..\..\..\..\..\Services\**\*.cs" />`
2. 用 `<Compile Remove>` 排除：
   - `Services/Framework/SystemIntegration/TrayIconService.cs`（Windows tray icon）
   - `Services/Framework/AI/SemanticKernel/UIMessageItem.cs`（WPF UI 类）
3. **GenerationProgressHub.cs 已改造**（本会话完成），源码包含后即生效。在启动期注册：

   ```csharp
   // Program.cs，app.Run() 之前：
   var notifier = app.Services.GetRequiredService<IGenerationNotifier>();
   TM.Services.Framework.AI.SemanticKernel.GenerationProgressHub.Bind(new SinkAdapter(notifier));

   // 然后在 LegacyBridge/Compatibility/ 新建：
   class SinkAdapter : GenerationProgressHub.IProgressSink {
       readonly IGenerationNotifier _n;
       public SinkAdapter(IGenerationNotifier n) => _n = n;
       public Task ReportAsync(string runId, string message) => _n.StatusAsync(runId, message);
   }
   ```

4. 按需补全 Framework 子集（`Framework/Common/Helpers/` 中除 WPF 依赖外的部分）
5. 处理新出现的编译错误（预期需要给 `TM.Framework.UI.Workspace.*`、`TM.Framework.Notifications.*` 加更多 stub）

## 为什么不在本次会话源码包含

- 原 Services 约 261 cs 文件，会带出 Framework / Modules / Core 的复杂耦合
- 一次接入需要补 50+ 个 stub 类，单会话风险高
- 优先把"能独立交付"的部分（数据层 + AI 模型管理）做完，LegacyBridge 留后续按模块迭代
