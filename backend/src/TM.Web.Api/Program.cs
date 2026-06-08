using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using TM.Web.Api.Hubs;
using TM.Web.Api.Http;
using TM.Web.Api.Middleware;
using TM.Web.Api.Notifications;
using TM.Web.Application.Dtos.Import;
using TM.Web.Application.Security;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Infrastructure.Security;
using TM.Web.Infrastructure.Services.Auth;
using TM.Web.Infrastructure.Services.Ai;
using TM.Web.Infrastructure.Services.Chat;
using TM.Web.Infrastructure.Services.Core;
using TM.Web.Infrastructure.Services.Design;
using TM.Web.Infrastructure.Services.Editor;
using TM.Web.Infrastructure.Services.Generation;
using TM.Web.Infrastructure.Services.Import;
using TM.Web.Infrastructure.Services.Notification;
using TM.Web.Infrastructure.Services.Recall;
using TM.Web.Infrastructure.Services.Tracking;
using TM.Web.Infrastructure.Services.Validation;
using TM.Web.LegacyBridge.Compatibility;
using TM.Web.LegacyBridge.Generation;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "tm-dev-cors";

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(opt =>
    {
        opt.InvalidModelStateResponseFactory = context =>
        {
            var problem = new ValidationProblemDetails(context.ModelState)
            {
                Type = "https://httpstatuses.io/400",
                Title = "请求参数验证失败",
                Status = StatusCodes.Status400BadRequest,
                Detail = "请检查表单中必填项、数据类型和取值范围后再提交。",
                Instance = context.HttpContext.Request.Path
            };

            return new BadRequestObjectResult(problem)
            {
                ContentTypes = { "application/problem+json" }
            };
        };
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();
builder.Services.AddOutboundHttpProxy(builder.Configuration);
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new()
    {
        Title = "TM Web API",
        Version = "v1",
        Description = "TM Web API for authoring, generation, validation, and editor workflows."
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

builder.Services.AddSingleton<IAiHttpClientFactory, OpenAiCompatibleHttpClientFactory>();
builder.Services.AddSingleton<IGenerationNotifier, SignalRGenerationNotifier>();
builder.Services.AddSingleton<IAiCompletionService, AiCompletionService>();
builder.Services.AddSingleton<IGenerationGateService, LegacyGenerationGateService>();
builder.Services.AddSingleton<IBookAnalysisBackgroundJobQueue, BookAnalysisBackgroundJobQueue>();
builder.Services.AddHostedService<BookAnalysisBackgroundWorker>();
builder.Services.AddSingleton<IChapterBatchGenerationJobQueue, ChapterBatchGenerationJobQueue>();
builder.Services.AddSingleton<IChapterBatchGenerationService, ChapterBatchGenerationService>();
builder.Services.AddHostedService<ChapterBatchGenerationWorker>();

builder.Services.AddAppDatabase(builder.Configuration);

builder.Services.AddSingleton<IKeyProtector, AesGcmKeyProtector>();
builder.Services.AddScoped<IAiProviderService, AiProviderService>();
builder.Services.AddScoped<IAiModelService, AiModelService>();
builder.Services.AddScoped<IAiApiKeyService, AiApiKeyService>();
builder.Services.AddScoped<IAiProviderConfigService, AiProviderConfigService>();
builder.Services.AddScoped<IDataImportService, DataImportService>();
builder.Services.AddScoped<INotificationHistoryService, NotificationHistoryService>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ISourceBookService, SourceBookService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IVolumeService, VolumeService>();
builder.Services.AddScoped<IChapterService, ChapterService>();
builder.Services.AddScoped<IEditorService, EditorService>();
builder.Services.AddScoped<GenerationStateService>();
builder.Services.AddScoped<NovelSeedService>();
builder.Services.AddScoped<INovelSeedService>(sp => sp.GetRequiredService<NovelSeedService>());
builder.Services.AddScoped<INovelSeedWorkflowService, NovelSeedWorkflowService>();
builder.Services.AddScoped<ITianmingProtocolService, TianmingProtocolService>();
builder.Services.AddScoped<IContextPackagingService, ContextPackagingService>();
builder.Services.AddScoped<IChapterDraftService, ChapterDraftService>();
builder.Services.AddScoped<IGenerationPreflightService, GenerationPreflightService>();
builder.Services.AddScoped<ISceneGenerationService, SceneGenerationService>();
builder.Services.AddScoped<IChapterAnalysisService, ChapterAnalysisService>();
builder.Services.AddScoped<IWorldRuleService, WorldRuleService>();
builder.Services.AddScoped<ICharacterRuleService, CharacterRuleService>();
builder.Services.AddScoped<IFactionRuleService, FactionRuleService>();
builder.Services.AddScoped<ILocationRuleService, LocationRuleService>();
builder.Services.AddScoped<IPlotRuleService, PlotRuleService>();
builder.Services.AddScoped<ICreativeMaterialService, CreativeMaterialService>();
builder.Services.AddScoped<IBookAnalysisService, BookAnalysisService>();
builder.Services.AddScoped<IBookAnalysisCrawlerService, BookAnalysisCrawlerService>();
builder.Services.AddScoped<IOutlineService, OutlineService>();
builder.Services.AddScoped<IVolumeDesignService, VolumeDesignService>();
builder.Services.AddScoped<IChapterPlanService, ChapterPlanService>();
builder.Services.AddScoped<IChapterBlueprintService, ChapterBlueprintService>();
builder.Services.AddScoped<IChapterEditorService, ChapterEditorService>();
builder.Services.AddScoped<IChapterRecallService, ChapterRecallService>();
builder.Services.AddScoped<INarrativeTrackingService, NarrativeTrackingService>();
builder.Services.AddScoped<IValidationService, ValidationService>();
builder.Services.AddScoped<IChatAssistantService, ChatAssistantService>();

builder.WebHost.ConfigureKestrel((ctx, kestrel) =>
{
    var explicitUrls = ctx.Configuration["ASPNETCORE_URLS"];
    if (string.IsNullOrWhiteSpace(explicitUrls))
    {
        var port = int.TryParse(ctx.Configuration["Server:Port"], out var p) ? p : 38721;
        kestrel.ListenAnyIP(port);
        kestrel.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
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
    // Do not mix EnsureCreated with migrations, or old SQLite files can drift
    // away from the migration history and miss later columns.
    await db.Database.MigrateAsync();
    await AuthSchemaCompatibility.EnsureAuthTablesAsync(db);
    await ChapterPlanSchemaCompatibility.EnsureProtocolColumnsAsync(db);
    await ChapterBatchGenerationSchemaCompatibility.EnsureTablesAsync(db);
    await NovelSeedWorkflowSchemaCompatibility.EnsureTablesAsync(db);
    await AiProviderSeeder.SeedAsync(db);
}

var importPathIndex = Array.IndexOf(args, "--import");
if (importPathIndex >= 0 && importPathIndex + 1 < args.Length)
{
    var sourcePath = args[importPathIndex + 1];
    using var importScope = app.Services.CreateScope();
    var importer = importScope.ServiceProvider.GetRequiredService<IDataImportService>();
    var report = await importer.ImportFromAsync(new ImportRequest(sourcePath));
    Console.WriteLine("\n=== Import Report ===");
    Console.WriteLine($"Source: {report.SourcePath}");
    Console.WriteLine($"Elapsed: {(report.FinishedAt - report.StartedAt).TotalMilliseconds:F0}ms");
    Console.WriteLine($"Success: {report.Success}");
    Console.WriteLine("Tables:");
    foreach (var t in report.Tables)
    {
        Console.WriteLine($"  - {t.Table,-25} read={t.Read,-5} insert={t.Inserted,-5} update={t.Updated,-5} skip={t.Skipped,-5} ({t.SourceFile})");
    }
    if (report.Warnings.Count > 0)
    {
        Console.WriteLine($"\nWarnings ({report.Warnings.Count}):");
        foreach (var w in report.Warnings) Console.WriteLine($"  - {w}");
    }
    if (report.Errors.Count > 0)
    {
        Console.WriteLine($"\nErrors ({report.Errors.Count}):");
        foreach (var e in report.Errors) Console.WriteLine($"  - {e}");
        return 1;
    }
    return 0;
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<AuthRequiredMiddleware>();

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

app.Lifetime.ApplicationStarted.Register(() =>
{
    var configuredUrls = app.Urls.Count > 0
        ? string.Join(", ", app.Urls)
        : builder.Configuration["ASPNETCORE_URLS"] ?? $"http://localhost:{builder.Configuration["Server:Port"] ?? "38721"}";
    var swaggerUrl = app.Environment.IsDevelopment()
        ? $"{configuredUrls.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "http://localhost:38721"}/swagger"
        : "开发环境启用";

    Console.WriteLine();
    Console.WriteLine("┌──────────────────────────────────────────────┐");
    Console.WriteLine("│  天命 Web · AI 网文写作助手                  │");
    Console.WriteLine("│  启动成功                                    │");
    Console.WriteLine($"│  API:     {TrimForBanner(configuredUrls),-35} │");
    Console.WriteLine("│  Web:     http://localhost:38720             │");
    Console.WriteLine($"│  Swagger: {TrimForBanner(swaggerUrl),-35} │");
    Console.WriteLine("└──────────────────────────────────────────────┘");
    Console.WriteLine();
});

app.Run();

return 0;

static string TrimForBanner(string value)
{
    const int max = 35;
    if (string.IsNullOrWhiteSpace(value)) return "-";
    return value.Length <= max ? value : value[..(max - 3)] + "...";
}
