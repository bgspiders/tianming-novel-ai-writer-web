using Microsoft.EntityFrameworkCore;
using TM.Web.Api.Hubs;
using TM.Web.Api.Middleware;
using TM.Web.Api.Notifications;
using TM.Web.Application.Dtos.Import;
using TM.Web.Application.Security;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Infrastructure.Security;
using TM.Web.Infrastructure.Services.Ai;
using TM.Web.Infrastructure.Services.Chat;
using TM.Web.Infrastructure.Services.Core;
using TM.Web.Infrastructure.Services.Design;
using TM.Web.Infrastructure.Services.Editor;
using TM.Web.Infrastructure.Services.Generation;
using TM.Web.Infrastructure.Services.Import;
using TM.Web.Infrastructure.Services.Validation;
using TM.Web.LegacyBridge.Compatibility;
using TM.Web.LegacyBridge.Generation;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "tm-dev-cors";

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new()
    {
        Title = "TM Web API",
        Version = "v1",
        Description = "天命 Web 版后端 API。阶段 0：仅包含健康检查与 AI 流式调用 Demo。"
    });
});

builder.Services.AddSignalR(opt =>
{
    opt.EnableDetailedErrors = builder.Environment.IsDevelopment();
    opt.MaximumReceiveMessageSize = 1024 * 1024;
});

builder.Services.AddCors(opt =>
{
    opt.AddPolicy(CorsPolicyName, p => p
        .WithOrigins(
            "http://localhost:38720",
            "http://127.0.0.1:38720"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.AddSingleton<IGenerationNotifier, SignalRGenerationNotifier>();
builder.Services.AddSingleton<IAiCompletionService, AiCompletionService>();
builder.Services.AddSingleton<IGenerationGateService, LegacyGenerationGateService>();

builder.Services.AddAppDatabase(builder.Configuration);

builder.Services.AddSingleton<IKeyProtector, AesGcmKeyProtector>();
builder.Services.AddScoped<IAiProviderService, AiProviderService>();
builder.Services.AddScoped<IAiModelService, AiModelService>();
builder.Services.AddScoped<IAiApiKeyService, AiApiKeyService>();
builder.Services.AddScoped<IDataImportService, DataImportService>();

// 阶段 3 — 设计模块服务
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ISourceBookService, SourceBookService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IVolumeService, VolumeService>();
builder.Services.AddScoped<IChapterService, ChapterService>();
builder.Services.AddScoped<IEditorService, EditorService>();
builder.Services.AddScoped<GenerationStateService>();
builder.Services.AddScoped<IChapterDraftService, ChapterDraftService>();
builder.Services.AddScoped<IWorldRuleService, WorldRuleService>();
builder.Services.AddScoped<ICharacterRuleService, CharacterRuleService>();
builder.Services.AddScoped<IFactionRuleService, FactionRuleService>();
builder.Services.AddScoped<ILocationRuleService, LocationRuleService>();
builder.Services.AddScoped<IPlotRuleService, PlotRuleService>();
builder.Services.AddScoped<ICreativeMaterialService, CreativeMaterialService>();
builder.Services.AddScoped<IBookAnalysisService, BookAnalysisService>();
builder.Services.AddScoped<IOutlineService, OutlineService>();
builder.Services.AddScoped<IVolumeDesignService, VolumeDesignService>();
builder.Services.AddScoped<IChapterPlanService, ChapterPlanService>();
builder.Services.AddScoped<IChapterBlueprintService, ChapterBlueprintService>();
builder.Services.AddScoped<IValidationService, ValidationService>();
builder.Services.AddScoped<IChatAssistantService, ChatAssistantService>();

builder.WebHost.ConfigureKestrel((ctx, kestrel) =>
{
    var explicitUrls = ctx.Configuration["ASPNETCORE_URLS"];
    if (string.IsNullOrWhiteSpace(explicitUrls))
    {
        var bindHost = ctx.HostingEnvironment.IsDevelopment() ? "127.0.0.1" : "0.0.0.0";
        var port = int.TryParse(ctx.Configuration["Server:Port"], out var p) ? p : 38721;
        kestrel.ListenAnyIP(port);
        kestrel.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
        Console.WriteLine($"[Kestrel] Binding to {bindHost}:{port}");
    }
});

var app = builder.Build();

LegacyLogBridge.Wire(app.Services);
GenerationProgressHubAdapter.Wire(app.Services.GetRequiredService<IGenerationNotifier>());
TM.Framework.Common.Helpers.Storage.StoragePathHelper.SetBasePath(
    DbServiceCollectionExtensions.ResolveStorageRoot(builder.Configuration));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.GetPendingMigrations().Any())
    {
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();
    }
    await AiProviderSeeder.SeedAsync(db);
}

// --import <path> CLI 模式：跑完导入即退出，不启动 HTTP 监听
var importPathIndex = Array.IndexOf(args, "--import");
if (importPathIndex >= 0 && importPathIndex + 1 < args.Length)
{
    var sourcePath = args[importPathIndex + 1];
    using var importScope = app.Services.CreateScope();
    var importer = importScope.ServiceProvider.GetRequiredService<IDataImportService>();
    var report = await importer.ImportFromAsync(new ImportRequest(sourcePath));
    Console.WriteLine($"\n=== 导入报告 ===");
    Console.WriteLine($"来源: {report.SourcePath}");
    Console.WriteLine($"耗时: {(report.FinishedAt - report.StartedAt).TotalMilliseconds:F0}ms");
    Console.WriteLine($"成功: {report.Success}");
    Console.WriteLine($"表统计:");
    foreach (var t in report.Tables)
    {
        Console.WriteLine($"  - {t.Table,-25} read={t.Read,-5} insert={t.Inserted,-5} update={t.Updated,-5} skip={t.Skipped,-5} ({t.SourceFile})");
    }
    if (report.Warnings.Count > 0)
    {
        Console.WriteLine($"\n警告 ({report.Warnings.Count})：");
        foreach (var w in report.Warnings) Console.WriteLine($"  ⚠ {w}");
    }
    if (report.Errors.Count > 0)
    {
        Console.WriteLine($"\n错误 ({report.Errors.Count})：");
        foreach (var e in report.Errors) Console.WriteLine($"  ✗ {e}");
        return 1;
    }
    return 0;
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(CorsPolicyName);

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.MapFallbackToFile("index.html");

app.Logger.LogInformation("TM Web API started. Swagger at /swagger");

app.Run();

return 0;
