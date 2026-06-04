using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Dtos.Validation;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Global;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class TianmingProtocolService : ITianmingProtocolService
{
    private static readonly TianmingProtocolDescriptorDto[] Protocols =
    {
        new("initialize", "初始化", "api.run.initialize", "初始化", "检查天命协议内核与项目知识库绑定状态。", new[] { "projectId" }),
        new("outline", "天命：大纲", "api.run.mandate_outline", "大纲", "输出战略宏图、宏观节奏宪章和知识库摘要。", new[] { "projectId" }),
        new("plan", "天命：规划", "api.run.mandate_plan", "规划", "按卷生成战役总蓝图和目录指令序列。", new[] { "projectId" }),
        new("directory", "天命：目录", "api.run.mandate_directory", "目录", "按章节区间输出战术执行目录。", new[] { "projectId", "startChapterNumber", "endChapterNumber" }),
        new("draft", "天命：草案", "api.run.mandate_draft", "草案", "把指定章节蓝图外部化为 300 字以内草案。", new[] { "projectId", "chapterNumber" }),
        new("manifest", "天命：正文", "api.run.mandate_manifest", "正文", "根据章节计划生成或预览正文执行提示。", new[] { "projectId", "chapterNumber" }),
        new("health_check", "天命：体检", "api.run.mandate_health_check", "体检", "扫描章序、缓冲比、状态链和伏笔健康度。", new[] { "projectId" }),
        new("archive", "天命：存档", "api.run.mandate_archive", "存档", "生成结构化更新补丁，沉淀新增实体和待决议事项。", new[] { "projectId" })
    };

    private static readonly (string Key, string FileName, string Title, string Description)[] KnowledgeBaseFiles =
    {
        ("world_stone", "世界基石.md", "世界基石", "动态核心：大纲、战术目录、伏笔总账和待决议事项。"),
        ("world_rules", "世界观规则.md", "世界观规则", "静态基石：世界硬规则、软规则、力量体系和历史锚点。"),
        ("character_archive", "角色档案.md", "角色档案", "静态基石：角色身份、弧光、关系、能力和装备。"),
        ("archive_events", "档案事件.md", "档案事件", "静态基石：剧情事件、时代锚点、参与方和影响。"),
        ("style_sample", "文风样本.md", "文风样本", "静态基石：当前项目的文气与写作风格约束。")
    };

    private readonly AppDbContext _db;
    private readonly IChapterDraftService _drafts;
    private readonly IValidationService _validation;

    public TianmingProtocolService(AppDbContext db, IChapterDraftService drafts, IValidationService validation)
    {
        _db = db;
        _drafts = drafts;
        _validation = validation;
    }

    public IReadOnlyList<TianmingProtocolDescriptorDto> ListProtocols() => Protocols;

    public IReadOnlyList<TianmingKnowledgeBaseFileDto> ListKnowledgeBaseFiles()
        => KnowledgeBaseFiles
            .Select(x => new TianmingKnowledgeBaseFileDto(x.Key, x.FileName, x.Title, x.Description, false, true, 0, DateTime.UtcNow, string.Empty))
            .ToList();

    public async Task<TianmingKnowledgeBaseBindingStatusDto> GetKnowledgeBaseStatusAsync(
        string projectId,
        string? sourceBookId = null,
        CancellationToken ct = default)
    {
        var files = await ExportKnowledgeBaseAsync(projectId, sourceBookId, ct);
        var missing = files.Where(x => x.IsMissing).Select(x => x.FileName).ToList();
        return new TianmingKnowledgeBaseBindingStatusDto(
            projectId,
            await ResolveSourceBookIdAsync(projectId, sourceBookId, ct),
            files,
            missing.Count == 0,
            missing);
    }

    public async Task<TianmingKnowledgeBaseFileDto> GetKnowledgeBaseFileAsync(
        string key,
        string projectId,
        string? sourceBookId = null,
        CancellationToken ct = default)
    {
        var all = await ExportKnowledgeBaseAsync(projectId, sourceBookId, ct);
        return all.FirstOrDefault(x => string.Equals(x.Key, key, StringComparison.OrdinalIgnoreCase))
               ?? throw new InvalidOperationException($"未知知识库文件：{key}");
    }

    public async Task<IReadOnlyList<TianmingKnowledgeBaseFileDto>> ExportKnowledgeBaseAsync(
        string projectId,
        string? sourceBookId = null,
        CancellationToken ct = default)
    {
        var scope = await LoadScopeAsync(new TianmingProtocolRequest("初始化", projectId, sourceBookId), ct);
        var generatedAt = DateTime.UtcNow;
        var files = new List<TianmingKnowledgeBaseFileDto>();

        foreach (var item in KnowledgeBaseFiles)
        {
            var imported = await GetImportedKnowledgeContentAsync(scope, item.Key, ct);
            var content = imported ?? (item.Key switch
            {
                "world_stone" => await RenderWorldStoneAsync(scope, ct),
                "world_rules" => await RenderWorldRulesAsync(scope, ct),
                "character_archive" => await RenderCharacterArchiveAsync(scope, ct),
                "archive_events" => await RenderArchiveEventsAsync(scope, ct),
                "style_sample" => await RenderStyleSampleAsync(scope, ct),
                _ => string.Empty
            });
            var isBound = imported != null || IsKnowledgeFileBound(scope, item.Key);
            files.Add(new TianmingKnowledgeBaseFileDto(
                item.Key,
                item.FileName,
                item.Title,
                item.Description,
                isBound,
                !isBound,
                content.Length,
                generatedAt,
                content));
        }

        return files;
    }

    public async Task<TianmingKnowledgeBaseFileDto> ImportKnowledgeBaseFileAsync(
        TianmingKnowledgeBaseImportRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.Key)) throw new InvalidOperationException("知识库文件 key 不能为空。");
        if (string.IsNullOrWhiteSpace(request.Content)) throw new InvalidOperationException("导入内容不能为空。");
        if (!KnowledgeBaseFiles.Any(x => string.Equals(x.Key, request.Key, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"未知知识库文件：{request.Key}");

        var sourceBookId = await ResolveSourceBookIdAsync(request.ProjectId, request.SourceBookId, ct);
        var key = BuildKnowledgeSettingKey(request.ProjectId, sourceBookId, request.Key);
        var setting = await _db.AppSettings.FirstOrDefaultAsync(x => x.Key == key, ct);
        if (setting == null)
        {
            setting = new AppSetting
            {
                Key = key,
                ValueType = "markdown"
            };
            _db.AppSettings.Add(setting);
        }
        setting.Value = request.Content.Trim();
        await _db.SaveChangesAsync(ct);
        return await GetKnowledgeBaseFileAsync(request.Key, request.ProjectId, sourceBookId, ct);
    }

    public async Task<TianmingProtocolResultDto> RunAsync(TianmingProtocolRequest request, CancellationToken ct = default)
    {
        var key = NormalizeCommand(request.Command);
        return key switch
        {
            "initialize" => await BuildInitializeAsync(request, ct),
            "outline" => await BuildOutlineAsync(request, ct),
            "plan" => await BuildPlanAsync(request, ct),
            "directory" => await BuildDirectoryAsync(request, ct),
            "draft" => await BuildDraftAsync(request, ct),
            "manifest" => await BuildManifestAsync(request, ct),
            "health_check" => await BuildHealthCheckAsync(request, ct),
            "archive" => await BuildArchiveAsync(request, ct),
            _ => throw new InvalidOperationException($"未知天命协议指令：{request.Command}")
        };
    }

    private async Task<TianmingProtocolResultDto> BuildInitializeAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var kbStatus = await GetKnowledgeBaseStatusAsync(scope.ProjectId, scope.SourceBookId, ct);
        string statusOf(string fileName) => kbStatus.Files.FirstOrDefault(x => x.FileName == fileName) is { } f
            ? f.IsBound ? "已连接" : "缺失"
            : "缺失";
        var lines = new List<string>
        {
            "【天命系统初始化报告】",
            "",
            "- 系统核心 ............ 已绑定",
            "- 绝对法典 ............ 已绑定",
            $"- 全局常数与内置知识库 ... 已绑定（数据库源书：{scope.SourceBookLabel}）",
            "- 运行协议 ............ 已绑定",
            "",
            "【统一知识库核心状态】",
            $"- 动态核心《世界基石.md》: {statusOf("世界基石.md")}",
            $"- 静态基石《世界观规则.md》: {statusOf("世界观规则.md")}",
            $"- 静态基石《角色档案.md》: {statusOf("角色档案.md")}",
            $"- 静态基石《档案事件.md》: {statusOf("档案事件.md")}",
            $"- 静态基石《文风样本.md》: {statusOf("文风样本.md")}",
            "",
            kbStatus.AllRequiredBound ? "五件套已全部绑定。" : $"绑定失败：核心缺失，原因：未发现 {string.Join("、", kbStatus.MissingRequiredFiles)}",
            $"结构化解析：章节蓝图 {scope.Knowledge.ParsedChapterPlans.Count} 条，准入实体 {scope.Knowledge.AllowedEntities.Count} 个，角色 {scope.Knowledge.CharacterNames.Count} 个，势力 {scope.Knowledge.FactionNames.Count} 个，地点 {scope.Knowledge.LocationNames.Count} 个。",
            "",
            "所有协议已映射到 Web API。执笔者可以继续下达大纲、规划、目录、草案、正文、体检、存档指令。"
        };

        return Result("initialize", "初始化", "ok", "天命系统初始化报告", string.Join('\n', lines), scope.Metadata);
    }

    private async Task<TianmingProtocolResultDto> BuildOutlineAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var worldStone = scope.Knowledge.GetContent("world_stone");
        if (!string.IsNullOrWhiteSpace(worldStone))
        {
            var strategicMap = scope.Knowledge.GetSection("world_stone", "战略宏图");
            var rhythmCharter = scope.Knowledge.GetSection("world_stone", "宏观节奏宪章");
            var eraMetadata = scope.Knowledge.GetSection("world_stone", "时代元数据包");
            if (!string.IsNullOrWhiteSpace(strategicMap) || !string.IsNullOrWhiteSpace(rhythmCharter))
            {
                var sbFromKb = new StringBuilder();
                sbFromKb.AppendLine("【战略宏图】");
                sbFromKb.AppendLine(FirstNonEmpty(strategicMap, "未在《世界基石.md》中发现战略宏图正文。"));
                sbFromKb.AppendLine();
                sbFromKb.AppendLine("【宏观节奏宪章】");
                sbFromKb.AppendLine(FirstNonEmpty(rhythmCharter, "未在《世界基石.md》中发现宏观节奏宪章正文。"));
                sbFromKb.AppendLine();
                sbFromKb.AppendLine("【时代元数据包】");
                sbFromKb.AppendLine(FirstNonEmpty(eraMetadata, $"allowed_entities: {JoinList(scope.Knowledge.AllowedEntities)}"));
                return Result("outline", "天命：大纲", "ok", "战略宏图与宏观节奏宪章", sbFromKb.ToString(), scope.Metadata);
            }
        }

        var outline = await _db.Outlines.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        var volumes = await _db.VolumeDesigns.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.VolumeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("【战略宏图】");
        sb.AppendLine($"- 项目：{scope.ProjectName}");
        sb.AppendLine($"- 一句话大纲：{FirstNonEmpty(outline?.OneLineOutline, scope.ProjectDescription, "未填写")}");
        sb.AppendLine($"- 主题：{FirstNonEmpty(outline?.Theme, "未填写")}");
        sb.AppendLine($"- 核心冲突：{FirstNonEmpty(outline?.CoreConflict, "未填写")}");
        sb.AppendLine($"- 结局状态：{FirstNonEmpty(outline?.EndingState, "未填写")}");
        sb.AppendLine();
        sb.AppendLine("【宏观节奏宪章】");
        sb.AppendLine("| 卷 | 卷名 | 章节范围 | 核心使命 | 终局锚点 |");
        sb.AppendLine("| :--- | :--- | :--- | :--- | :--- |");
        foreach (var v in volumes)
        {
            sb.AppendLine($"| 卷{v.VolumeNumber} | {v.VolumeTitle} | {v.StartChapter}-{v.EndChapter} | {FirstNonEmpty(v.StageGoal, v.MainConflict)} | {FirstNonEmpty(v.EndingState, v.KeyEvents)} |");
        }
        if (volumes.Count == 0) sb.AppendLine("| - | 未生成卷设计 | - | 请先生成或录入卷设计 | - |");

        return Result("outline", "天命：大纲", "ok", "战略宏图与宏观节奏宪章", sb.ToString(), scope.Metadata);
    }

    private async Task<TianmingProtocolResultDto> BuildPlanAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var volumes = await _db.VolumeDesigns.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.VolumeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        foreach (var volume in volumes)
        {
            sb.AppendLine($"### 【卷{volume.VolumeNumber}：{volume.VolumeTitle}【{volume.TargetChapterCount}章】 · 战略蓝图】");
            sb.AppendLine();
            sb.AppendLine($"战略解析：{FirstNonEmpty(volume.StageGoal, volume.MainConflict, volume.KeyEvents, "未填写")}");
            sb.AppendLine();
            sb.AppendLine("* **生成指令序列：**");
            sb.AppendLine();
            sb.AppendLine("| 宏观阶段 (Phase) | 战术剧情弧光 (Tactical Arc) | 章节范围 (Chapters) | 核心剧情推演 (Key Story Arcs) | 指令序列 (Command) |");
            sb.AppendLine("| :--- | :--- | :--- | :--- | :--- |");

            var plans = scope.ChapterPlans
                .Where(x => x.Volume == volume.VolumeTitle || (x.ChapterNumber >= volume.StartChapter && x.ChapterNumber <= volume.EndChapter))
                .OrderBy(x => x.ChapterNumber)
                .ToList();
            foreach (var group in plans.GroupBy(x => FirstNonEmpty(x.TacticalArcId, $"卷{volume.VolumeNumber}.{Math.Max(1, (x.ChapterNumber - volume.StartChapter) / 10 + 1)}")))
            {
                var first = group.First();
                var last = group.Last();
                var phase = FirstNonEmpty(first.MacroPhase, EstimatePhase(first.ChapterNumber, volume.StartChapter, volume.EndChapter));
                var arcTitle = FirstNonEmpty(first.TacticalArcTitle, first.ChapterTheme, first.MainGoal);
                var story = FirstNonEmpty(first.CoreEvent, first.MainPlotProgress, first.MainGoal);
                sb.AppendLine($"| **【{phase}】** | **{group.Key} {arcTitle}** | {group.Count()}章 ({first.ChapterNumber}-{last.ChapterNumber}) | {story} | `「天命：目录 | 卷{volume.VolumeNumber} 第{first.ChapterNumber}-{last.ChapterNumber}章」` |");
            }

            if (plans.Count == 0)
            {
                sb.AppendLine($"| **【起】** | **待生成战术弧光** | {volume.TargetChapterCount}章 ({volume.StartChapter}-{volume.EndChapter}) | {FirstNonEmpty(volume.KeyEvents, volume.MainConflict)} | `「天命：目录 | 卷{volume.VolumeNumber} 第{volume.StartChapter}-{volume.EndChapter}章」` |");
            }
            sb.AppendLine("────────────────────");
            sb.AppendLine();
        }

        if (volumes.Count == 0) sb.AppendLine("未找到卷设计，请先执行 AI 开书或录入卷设计。");
        return Result("plan", "天命：规划", "ok", "全书战役总蓝图", sb.ToString(), scope.Metadata);
    }

    private async Task<TianmingProtocolResultDto> BuildDirectoryAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var gateIssues = ValidateDirectoryScope(scope, request.StartChapterNumber, request.EndChapterNumber);
        var fatal = gateIssues.Where(IsFatalIssue).ToList();
        if (fatal.Count > 0)
        {
            return Fatal("directory", "天命：目录", "目录协议门禁未通过", fatal, scope.Metadata);
        }

        var start = request.StartChapterNumber ?? request.ChapterNumber ?? 1;
        var end = request.EndChapterNumber ?? start;
        if (end < start) (start, end) = (end, start);

        var plans = scope.ChapterPlans
            .Where(x => x.ChapterNumber >= start && x.ChapterNumber <= end)
            .OrderBy(x => x.ChapterNumber)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine("【战术执行目录】");
        if (gateIssues.Count > 0)
        {
            sb.AppendLine("【非阻断提示】");
            foreach (var issue in gateIssues) sb.AppendLine($"- {issue}");
            sb.AppendLine();
        }
        sb.AppendLine("| 章序 | 标题 | 类型 | 冲突值 | 核心事件 | 悬念钩子 | 时空锚点 |");
        sb.AppendLine("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
        foreach (var p in plans)
        {
            sb.AppendLine($"| {p.ChapterNumber} | {p.ChapterTitle} | {FirstNonEmpty(p.ChapterType, "主线")} | {FirstNonEmpty(p.ConflictScore, "★★★☆☆")} | {FirstNonEmpty(p.CoreEvent, p.MainPlotProgress, p.MainGoal)} | {p.Hook} | {FirstNonEmpty(p.TimelineCoordinate, p.TemporalAnchor, p.SpatialAnchor)} |");
        }
        if (plans.Count == 0) sb.AppendLine($"| {start}-{end} | 未找到章节计划 | - | - | 请先生成章节计划 | - | - |");

        return Result("directory", "天命：目录", plans.Count > 0 ? "ok" : "missing", "战术执行目录", sb.ToString(), scope.Metadata);
    }

    private async Task<TianmingProtocolResultDto> BuildDraftAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var plan = await LoadPlanByChapterAsync(request, ct);
        var scope = await LoadScopeAsync(request, ct);
        var fatal = ValidateDraftPlan(plan, scope);
        if (fatal.Count > 0)
        {
            return Fatal("draft", "天命：草案", $"第 {plan.ChapterNumber} 章草案门禁未通过", fatal, scope.Metadata);
        }

        var sb = new StringBuilder();
        sb.AppendLine("【显化蓝图草案】");
        sb.AppendLine();
        sb.AppendLine("一、章节核心");
        sb.AppendLine(TrimText(FirstNonEmpty(plan.CoreEvent, plan.MainGoal, plan.MainPlotProgress), 30));
        sb.AppendLine();
        sb.AppendLine("二、核心情节");
        sb.AppendLine($"- 起：{TrimText(FirstNonEmpty(plan.MainGoal, plan.ChapterTheme), 50)}");
        sb.AppendLine($"- 承：{TrimText(FirstNonEmpty(plan.ResistanceSource, plan.CoreEvent), 50)}");
        sb.AppendLine($"- 转：{TrimText(plan.KeyTurn, 50)}");
        sb.AppendLine($"- 合：{TrimText(FirstNonEmpty(plan.Hook, plan.MainPlotProgress), 50)}");
        sb.AppendLine();
        sb.AppendLine("三、悬念钩子");
        sb.AppendLine(plan.Hook);
        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine($"「天命：正文 | 卷[{plan.Volume}]，第[{plan.ChapterNumber}]章 | 净字＞3500」");

        var content = TrimText(sb.ToString(), 420);
        return Result("draft", "天命：草案", "ok", $"第 {plan.ChapterNumber} 章草案", content, new()
        {
            ["chapterNumber"] = plan.ChapterNumber.ToString(),
            ["maxBodyChars"] = "300"
        });
    }

    private async Task<TianmingProtocolResultDto> BuildManifestAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var chapter = await LoadChapterAsync(request, ct);
        var scope = await LoadScopeAsync(request with { ChapterNumber = chapter.ChapterNumber }, ct);
        var planForGate = scope.ChapterPlans.FirstOrDefault(x => x.ChapterNumber == chapter.ChapterNumber);
        var fatal = ValidateManifestPlan(planForGate, scope);
        if (fatal.Count > 0)
        {
            return Fatal("manifest", "天命：正文", $"第 {chapter.ChapterNumber} 章正文门禁未通过", fatal, scope.Metadata);
        }

        if (!string.IsNullOrWhiteSpace(request.Endpoint) && !string.IsNullOrWhiteSpace(request.Model))
        {
            var draft = await _drafts.GenerateDraftAsync(new ChapterDraftRequest
            {
                RunId = $"tianming_{Guid.NewGuid():N}",
                ProjectId = chapter.ProjectId,
                VolumeId = chapter.VolumeId,
                ChapterId = chapter.Id,
                ConfigId = request.ConfigId,
                ProviderId = request.ProviderId,
                ApiKeyId = request.ApiKeyId,
                ApiKey = request.ApiKey ?? string.Empty,
                Endpoint = request.Endpoint!,
                Model = request.Model!,
                SystemPrompt = FirstNonEmpty(request.SystemPrompt, "你是天命长篇小说系统。只输出章节正文。"),
            Prompt = FirstNonEmpty(request.Prompt, $"「天命：正文 | 第{chapter.ChapterNumber}章」\n请严格依据自动召回的章节计划生成正文。"),
                Temperature = request.Temperature.HasValue ? (float)request.Temperature.Value : null,
                MaxTokens = request.MaxTokens,
                SaveToChapter = request.SaveToChapter
            }, ct);

            return Result("manifest", "天命：正文", "ok", $"第 {chapter.ChapterNumber} 章正文", $"正文生成完成。字数：{draft.WordCount}，记录：{draft.GenerationRecordId}", new()
            {
                ["chapterId"] = chapter.Id,
                ["generationRecordId"] = draft.GenerationRecordId ?? string.Empty
            });
        }

        var plan = planForGate ?? await LoadPlanByChapterAsync(request with { ChapterNumber = chapter.ChapterNumber }, ct);
        var content = string.Join('\n', new[]
        {
            $"「天命：正文 | 第{chapter.ChapterNumber}章 {chapter.Title}」",
            "",
            "当前未填写 Endpoint/模型，已生成正文执行提示：",
            "知识库锁定：优先使用《世界基石.md》# 战术执行目录，其次使用世界观规则、角色档案、档案事件、文风样本。",
            $"核心事件：{FirstNonEmpty(plan.CoreEvent, plan.MainGoal)}",
            $"章节类型：{FirstNonEmpty(plan.ChapterType, "主线")}",
            $"冲突值：{FirstNonEmpty(plan.ConflictScore, "★★★☆☆")}",
            $"悬念钩子：{plan.Hook}",
            $"时空锚点：{FirstNonEmpty(plan.TimelineCoordinate, plan.TemporalAnchor, plan.SpatialAnchor)}",
            $"准入实体：{JoinList(plan.AllowedEntities)}",
            "字数协议：先生成 4500-5500 净字精修初稿，再压缩稳定到 3500-4000 净字。",
            "封装协议：最终只输出 markdown 正文，不残留 [REF]、[VAR]、内部日志。"
        });

        return Result("manifest", "天命：正文", "preview", $"第 {chapter.ChapterNumber} 章正文提示", content, new() { ["chapterId"] = chapter.Id });
    }

    private async Task<TianmingProtocolResultDto> BuildHealthCheckAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var fatal = ValidateHealthScope(scope);
        var chapters = await _db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == request.ProjectId)
            .OrderBy(x => x.ChapterNumber)
            .ToListAsync(ct);
        var missingNumbers = chapters.Count == 0
            ? new List<int>()
            : Enumerable.Range(chapters.Min(x => x.ChapterNumber), chapters.Max(x => x.ChapterNumber) - chapters.Min(x => x.ChapterNumber) + 1)
                .Except(chapters.Select(x => x.ChapterNumber))
                .ToList();
        var bufferCount = scope.ChapterPlans.Count(x => x.ChapterType.StartsWith("缓冲", StringComparison.OrdinalIgnoreCase));
        var bufferRatio = scope.ChapterPlans.Count == 0 ? 0 : Math.Round(bufferCount * 100.0 / scope.ChapterPlans.Count, 1);

        var validation = !string.IsNullOrWhiteSpace(request.ProjectId)
            ? await _validation.ListSummariesAsync(request.ProjectId!, request.VolumeNumber, ct)
            : Array.Empty<ValidationSummaryDto>();

        var sb = new StringBuilder();
        sb.AppendLine("【世界基石体检报告】");
        sb.AppendLine($"- 目录连续性：{(missingNumbers.Count == 0 ? "通过" : $"缺失章节 {string.Join(", ", missingNumbers.Take(20))}")}");
        sb.AppendLine($"- 缓冲比：{bufferRatio}%（缓冲章节 {bufferCount}/{scope.ChapterPlans.Count}）");
        sb.AppendLine($"- 状态标记章节：{scope.ChapterPlans.Count(x => !string.IsNullOrWhiteSpace(x.StatusMarkers))}");
        sb.AppendLine($"- 奇点事件章节：{scope.ChapterPlans.Count(x => x.IsSingularityEvent)}");
        sb.AppendLine($"- Tier-1/2 伏笔章节：{scope.ChapterPlans.Count(x => x.ForeshadowingTier is "Tier-1" or "Tier-2")}");
        sb.AppendLine($"- 沉睡伏笔预警：{BuildDormantForeshadowingWarning(scope.ChapterPlans)}");
        sb.AppendLine($"- 最新校验摘要：{validation.FirstOrDefault()?.OverallResult ?? "暂无"}");
        if (fatal.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("【FATAL / ERROR】");
            foreach (var item in fatal) sb.AppendLine($"- {item}");
            return Result("health_check", "天命：体检", "fatal", "世界基石体检报告", sb.ToString(), scope.Metadata);
        }

        return Result("health_check", "天命：体检", "ok", "世界基石体检报告", sb.ToString(), scope.Metadata);
    }

    private async Task<TianmingProtocolResultDto> BuildArchiveAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var sb = new StringBuilder();
        sb.AppendLine("## 【结构化更新补丁】");
        sb.AppendLine("*   **数据源：** `当前项目 SQLite 设计数据与章节计划`");
        sb.AppendLine("*   **建议操作：** 请执笔者审查以下内容，确认无误后整合至《世界基石.md》。");
        sb.AppendLine("---");
        sb.AppendLine("### 一、 新增实体总览");
        sb.AppendLine("#### **角色 (Character)**");
        sb.AppendLine(scope.CharacterCount > 0 ? $"*   当前角色档案数量：{scope.CharacterCount}" : "（本次会话无新增）");
        sb.AppendLine("#### **组织 (Faction)**");
        sb.AppendLine(scope.FactionCount > 0 ? $"*   当前势力档案数量：{scope.FactionCount}" : "（本次会话无新增）");
        sb.AppendLine("#### **地点 (Location)**");
        sb.AppendLine(scope.LocationCount > 0 ? $"*   当前地点档案数量：{scope.LocationCount}" : "（本次会话无新增）");
        sb.AppendLine("#### **物品 (Item)**");
        sb.AppendLine("（本次会话无新增）");
        sb.AppendLine("#### **概念/事件 (Event/Concept)**");
        foreach (var p in scope.ChapterPlans.Where(x => x.IsSingularityEvent || !string.IsNullOrWhiteSpace(x.StatusMarkers)).Take(20))
        {
            sb.AppendLine($"*   **[E-待定] 第{p.ChapterNumber}章事件:** {FirstNonEmpty(p.CoreEvent, p.MainPlotProgress, p.Hook)}");
        }
        if (!scope.ChapterPlans.Any(x => x.IsSingularityEvent || !string.IsNullOrWhiteSpace(x.StatusMarkers))) sb.AppendLine("（本次会话无新增）");
        sb.AppendLine("---");
        sb.AppendLine("### 二、 待决议事项总览");
        sb.AppendLine("（本次会话无新增）");

        return Result("archive", "天命：存档", "ok", "结构化更新补丁", sb.ToString(), scope.Metadata);
    }

    private async Task<string> RenderWorldStoneAsync(TianmingScope scope, CancellationToken ct)
    {
        var outline = await _db.Outlines.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        var volumes = await _db.VolumeDesigns.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.VolumeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("# 世界基石");
        sb.AppendLine();
        sb.AppendLine("## 战略宏图");
        sb.AppendLine($"- 项目：{scope.ProjectName}");
        sb.AppendLine($"- 一句话大纲：{FirstNonEmpty(outline?.OneLineOutline, scope.ProjectDescription, "未填写")}");
        sb.AppendLine($"- 主题：{FirstNonEmpty(outline?.Theme, "未填写")}");
        sb.AppendLine($"- 核心冲突：{FirstNonEmpty(outline?.CoreConflict, "未填写")}");
        sb.AppendLine($"- 结局状态：{FirstNonEmpty(outline?.EndingState, "未填写")}");
        sb.AppendLine();
        sb.AppendLine("## 宏观节奏宪章");
        sb.AppendLine("| 卷 | 卷名 | 章节范围 | 核心使命 | 终局锚点 |");
        sb.AppendLine("| :--- | :--- | :--- | :--- | :--- |");
        foreach (var v in volumes)
        {
            sb.AppendLine($"| 卷{v.VolumeNumber} | {v.VolumeTitle} | {v.StartChapter}-{v.EndChapter} | {FirstNonEmpty(v.StageGoal, v.MainConflict)} | {FirstNonEmpty(v.EndingState, v.KeyEvents)} |");
        }
        if (volumes.Count == 0) sb.AppendLine("| - | 未生成卷设计 | - | - | - |");
        sb.AppendLine();
        sb.AppendLine("## 战术执行目录");
        sb.AppendLine("| 章序 | 标题 | 阶段 | 弧光 | 类型 | 冲突值 | 核心事件 | 悬念钩子 |");
        sb.AppendLine("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
        foreach (var p in scope.ChapterPlans)
        {
            sb.AppendLine($"| {p.ChapterNumber} | {p.ChapterTitle} | {p.MacroPhase} | {FirstNonEmpty(p.TacticalArcId, p.TacticalArcTitle)} | {p.ChapterType} | {p.ConflictScore} | {FirstNonEmpty(p.CoreEvent, p.MainPlotProgress, p.MainGoal)} | {p.Hook} |");
        }
        if (scope.ChapterPlans.Count == 0) sb.AppendLine("| - | 未生成章节计划 | - | - | - | - | - | - |");
        sb.AppendLine();
        sb.AppendLine("## 全局伏笔总账");
        foreach (var p in scope.ChapterPlans.Where(x => !string.IsNullOrWhiteSpace(x.Foreshadowing)))
        {
            sb.AppendLine($"- 第{p.ChapterNumber}章：{p.Foreshadowing}");
        }
        if (!scope.ChapterPlans.Any(x => !string.IsNullOrWhiteSpace(x.Foreshadowing))) sb.AppendLine("- 暂无。");
        sb.AppendLine();
        sb.AppendLine("## 待决议事项");
        sb.AppendLine("- 暂无。");
        return sb.ToString();
    }

    private async Task<string> RenderWorldRulesAsync(TianmingScope scope, CancellationToken ct)
    {
        var rules = await _db.WorldRules.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        var sb = new StringBuilder();
        sb.AppendLine("# 世界观规则");
        foreach (var r in rules)
        {
            sb.AppendLine();
            sb.AppendLine($"## {r.Name}");
            AppendLine(sb, "一句话概述", r.OneLineSummary);
            AppendLine(sb, "力量/技术体系", r.PowerSystem);
            AppendLine(sb, "宇宙观/社会结构", r.Cosmology);
            AppendLine(sb, "特殊规则", r.SpecialLaws);
            AppendLine(sb, "硬规则", r.HardRules);
            AppendLine(sb, "软规则", r.SoftRules);
            AppendLine(sb, "远古时代", r.AncientEra);
            AppendLine(sb, "关键历史事件", r.KeyEvents);
            AppendLine(sb, "近代背景", r.ModernHistory);
            AppendLine(sb, "开篇现状", r.StatusQuo);
        }
        if (rules.Count == 0) sb.AppendLine("\n> 暂无世界观规则。");
        return sb.ToString();
    }

    private async Task<string> RenderCharacterArchiveAsync(TianmingScope scope, CancellationToken ct)
    {
        var characters = await _db.CharacterRules.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        var sb = new StringBuilder();
        sb.AppendLine("# 角色档案");
        foreach (var c in characters)
        {
            sb.AppendLine();
            sb.AppendLine($"## {c.Name}");
            AppendLine(sb, "类型", c.CharacterType);
            AppendLine(sb, "性别/年龄/身份", string.Join(" / ", new[] { c.Gender, c.Age, c.Identity }.Where(x => !string.IsNullOrWhiteSpace(x))));
            AppendLine(sb, "外观", c.Appearance);
            AppendLine(sb, "外在欲望", c.Want);
            AppendLine(sb, "内在需求", c.Need);
            AppendLine(sb, "缺陷信念", c.FlawBelief);
            AppendLine(sb, "成长路径", c.GrowthPath);
            AppendLine(sb, "关系对象", c.TargetCharacterName);
            AppendLine(sb, "关系类型", c.RelationshipType);
            AppendLine(sb, "情绪动态", c.EmotionDynamic);
            AppendLine(sb, "战斗能力", c.CombatSkills);
            AppendLine(sb, "非战斗能力", c.NonCombatSkills);
            AppendLine(sb, "特殊能力", c.SpecialAbilities);
            AppendLine(sb, "标志物", c.SignatureItems);
            AppendLine(sb, "常用物品", c.CommonItems);
            AppendLine(sb, "个人资产", c.PersonalAssets);
        }
        if (characters.Count == 0) sb.AppendLine("\n> 暂无角色档案。");
        return sb.ToString();
    }

    private async Task<string> RenderArchiveEventsAsync(TianmingScope scope, CancellationToken ct)
    {
        var plots = await _db.PlotRules.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.TargetVolume)
            .ThenBy(x => x.Name)
            .ToListAsync(ct);
        var factions = await _db.FactionRules.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        var locations = await _db.LocationRules.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("# 档案事件");
        sb.AppendLine();
        sb.AppendLine("## 剧情事件");
        foreach (var p in plots)
        {
            sb.AppendLine();
            sb.AppendLine($"### {p.Name}");
            AppendLine(sb, "目标卷", p.TargetVolume);
            AppendLine(sb, "分配卷", p.AssignedVolume);
            AppendLine(sb, "一句话摘要", p.OneLineSummary);
            AppendLine(sb, "事件类型", p.EventType);
            AppendLine(sb, "故事阶段", p.StoryPhase);
            AppendLine(sb, "前置/触发", p.PrerequisitesTrigger);
            AppendLine(sb, "参与角色", p.MainCharacters);
            AppendLine(sb, "关键 NPC", p.KeyNpcs);
            AppendLine(sb, "地点", p.Location);
            AppendLine(sb, "时间/持续", p.TimeDuration);
            AppendLine(sb, "目标", p.Goal);
            AppendLine(sb, "冲突", p.Conflict);
            AppendLine(sb, "结果", p.Result);
            AppendLine(sb, "影响", FirstNonEmpty(p.MainPlotPush, p.CharacterGrowth, p.WorldReveal, p.RewardsClues));
        }
        if (plots.Count == 0) sb.AppendLine("- 暂无剧情事件。");
        sb.AppendLine();
        sb.AppendLine("## 势力档案");
        foreach (var f in factions)
        {
            sb.AppendLine();
            sb.AppendLine($"### {f.Name}");
            AppendLine(sb, "类型", f.FactionType);
            AppendLine(sb, "目标", f.Goal);
            AppendLine(sb, "地盘/实力", f.StrengthTerritory);
            AppendLine(sb, "领袖", f.Leader);
            AppendLine(sb, "核心成员", f.CoreMembers);
            AppendLine(sb, "盟友", f.Allies);
            AppendLine(sb, "敌人", f.Enemies);
        }
        if (factions.Count == 0) sb.AppendLine("- 暂无势力档案。");
        sb.AppendLine();
        sb.AppendLine("## 地点档案");
        foreach (var l in locations)
        {
            sb.AppendLine();
            sb.AppendLine($"### {l.Name}");
            AppendLine(sb, "类型", l.LocationType);
            AppendLine(sb, "描述", l.Description);
            AppendLine(sb, "规模", l.Scale);
            AppendLine(sb, "地貌", l.Terrain);
            AppendLine(sb, "气候/氛围", l.Climate);
            AppendLine(sb, "地标", JoinList(l.Landmarks));
            AppendLine(sb, "资源", JoinList(l.Resources));
            AppendLine(sb, "危险", JoinList(l.Dangers));
            AppendLine(sb, "历史意义", l.HistoricalSignificance);
        }
        if (locations.Count == 0) sb.AppendLine("- 暂无地点档案。");
        return sb.ToString();
    }

    private async Task<string> RenderStyleSampleAsync(TianmingScope scope, CancellationToken ct)
    {
        var material = await _db.CreativeMaterials.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        var outline = await _db.Outlines.AsNoTracking()
            .Where(x => x.SourceBookId == scope.SourceBookId && x.IsEnabled)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("# 文风样本");
        sb.AppendLine();
        sb.AppendLine("## 文气基准");
        AppendLine(sb, "情绪基调", outline?.EmotionalTone ?? string.Empty);
        AppendLine(sb, "题材类型", material?.Genre ?? string.Empty);
        AppendLine(sb, "整体创意", material?.OverallIdea ?? string.Empty);
        AppendLine(sb, "角色亮点", material?.CharacterHighlights ?? string.Empty);
        AppendLine(sb, "剧情亮点", material?.PlotHighlights ?? string.Empty);
        sb.AppendLine();
        sb.AppendLine("## 写作约束");
        sb.AppendLine("- 优先遵守章节计划的核心事件、章节类型、冲突值和悬念钩子。");
        sb.AppendLine("- 对话推进人物关系，动作承担情绪，不用空泛总结替代场景。");
        sb.AppendLine("- 若缺少真实文风样本，请在此文件中补充 1000-3000 字人工样章。");
        return sb.ToString();
    }

    private async Task<TianmingScope> LoadScopeAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
            throw new InvalidOperationException("项目 ID 不能为空。");

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
            ?? throw new InvalidOperationException("项目不存在。");
        var sourceBookId = string.IsNullOrWhiteSpace(request.SourceBookId) ? project.CurrentSourceBookId : request.SourceBookId;

        var plans = string.IsNullOrWhiteSpace(sourceBookId)
            ? new List<ChapterPlan>()
            : await _db.ChapterPlans.AsNoTracking()
                .Where(x => x.SourceBookId == sourceBookId && x.IsEnabled)
                .OrderBy(x => x.ChapterNumber)
                .ToListAsync(ct);

        var knowledge = await BuildKnowledgeSnapshotAsync(project.Id, sourceBookId, ct);
        var mergedPlans = EnrichProtocolPlans(MergeChapterPlans(plans, knowledge.ParsedChapterPlans), knowledge);

        var metadata = new Dictionary<string, string>
        {
            ["projectId"] = project.Id,
            ["projectName"] = project.Name,
            ["sourceBookId"] = sourceBookId ?? string.Empty,
            ["knowledgeSource"] = knowledge.IsAnyImported ? "markdown-first" : "sqlite",
            ["parsedBlueprints"] = knowledge.ParsedChapterPlans.Count.ToString(),
            ["allowedEntities"] = knowledge.AllowedEntities.Count.ToString()
        };

        return new TianmingScope(
            project.Id,
            project.Name,
            project.Description ?? string.Empty,
            sourceBookId,
            string.IsNullOrWhiteSpace(sourceBookId) ? "未绑定" : sourceBookId,
            await CountAsync(_db.WorldRules.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await CountAsync(_db.CharacterRules.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await CountAsync(_db.FactionRules.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await CountAsync(_db.LocationRules.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await CountAsync(_db.PlotRules.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await CountAsync(_db.CreativeMaterials.AsNoTracking().Where(x => x.SourceBookId == sourceBookId && x.IsEnabled), ct),
            await _db.Outlines.AsNoTracking().AnyAsync(x => x.SourceBookId == sourceBookId && x.IsEnabled, ct),
            knowledge,
            mergedPlans,
            metadata);
    }

    private static IReadOnlyList<ChapterPlan> MergeChapterPlans(
        IReadOnlyList<ChapterPlan> databasePlans,
        IReadOnlyList<ChapterPlan> parsedPlans)
    {
        if (parsedPlans.Count == 0) return databasePlans;
        if (databasePlans.Count == 0) return parsedPlans;

        var dbByNumber = databasePlans.ToDictionary(x => x.ChapterNumber);
        var merged = new List<ChapterPlan>();
        foreach (var parsed in parsedPlans)
        {
            if (!dbByNumber.TryGetValue(parsed.ChapterNumber, out var db))
            {
                merged.Add(parsed);
                continue;
            }

            db.ChapterTitle = FirstNonEmpty(parsed.ChapterTitle, db.ChapterTitle);
            db.MacroPhase = FirstNonEmpty(parsed.MacroPhase, db.MacroPhase);
            db.TacticalArcId = FirstNonEmpty(parsed.TacticalArcId, db.TacticalArcId);
            db.ChapterType = FirstNonEmpty(parsed.ChapterType, db.ChapterType);
            db.ConflictScore = FirstNonEmpty(parsed.ConflictScore, db.ConflictScore);
            db.CoreEvent = FirstNonEmpty(parsed.CoreEvent, db.CoreEvent);
            db.Hook = FirstNonEmpty(parsed.Hook, db.Hook);
            db.MainGoal = FirstNonEmpty(parsed.MainGoal, db.MainGoal);
            db.MainPlotProgress = FirstNonEmpty(parsed.MainPlotProgress, db.MainPlotProgress);
            merged.Add(db);
        }

        merged.AddRange(databasePlans.Where(x => parsedPlans.All(p => p.ChapterNumber != x.ChapterNumber)));
        return merged.OrderBy(x => x.ChapterNumber).ToList();
    }

    private static IReadOnlyList<ChapterPlan> EnrichProtocolPlans(
        IReadOnlyList<ChapterPlan> plans,
        TianmingKnowledgeSnapshot knowledge)
    {
        if (plans.Count == 0) return plans;
        var firstChapter = plans.Min(x => x.ChapterNumber);
        var lastChapter = plans.Max(x => x.ChapterNumber);

        foreach (var plan in plans)
        {
            var stage = EstimateProtocolStage(plan.ChapterNumber, firstChapter, lastChapter);
            plan.MacroPhase = FirstNonEmpty(plan.MacroPhase, stage.Phase);
            plan.ChapterType = FirstNonEmpty(plan.ChapterType, stage.ChapterType);
            plan.ConflictScore = FirstNonEmpty(plan.ConflictScore, stage.ConflictScore);
            plan.CoreEvent = FirstNonEmpty(plan.CoreEvent, plan.MainPlotProgress, plan.MainGoal, plan.ChapterTheme, stage.CoreEvent);
            plan.MainGoal = FirstNonEmpty(plan.MainGoal, plan.CoreEvent, stage.CoreEvent);
            plan.Hook = FirstNonEmpty(plan.Hook, stage.Hook);
            plan.TacticalArcId = FirstNonEmpty(plan.TacticalArcId, $"弧光{Math.Max(1, (plan.ChapterNumber - firstChapter) / 10 + 1)}");
            plan.TacticalArcTitle = FirstNonEmpty(plan.TacticalArcTitle, stage.ArcTitle);
            plan.StatusMarkers = FirstNonEmpty(plan.StatusMarkers, $"阶段:{plan.MacroPhase};类型:{plan.ChapterType}");
            plan.TemporalAnchor = FirstNonEmpty(plan.TemporalAnchor, $"第 {plan.ChapterNumber} 章时段");
            plan.SpatialAnchor = FirstNonEmpty(plan.SpatialAnchor, plan.ReferencedLocationNames.FirstOrDefault(), knowledge.LocationNames.FirstOrDefault());
            plan.TimelineCoordinate = FirstNonEmpty(plan.TimelineCoordinate, $"章{plan.ChapterNumber}/阶段{plan.MacroPhase}");
            plan.BufferRole = FirstNonEmpty(plan.BufferRole, stage.BufferRole);

            if (plan.AllowedEntities.Count == 0)
            {
                plan.AllowedEntities = plan.ReferencedCharacterNames
                    .Concat(plan.ReferencedFactionNames)
                    .Concat(plan.ReferencedLocationNames)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
        }

        return plans;
    }

    private static (string Phase, string ChapterType, string ConflictScore, string CoreEvent, string Hook, string ArcTitle, string BufferRole)
        EstimateProtocolStage(int chapterNumber, int firstChapter, int lastChapter)
    {
        var ratio = (chapterNumber - firstChapter + 1) / (double)Math.Max(1, lastChapter - firstChapter + 1);
        if (ratio < 0.25)
            return ("起", "缓冲-线索", "★★☆☆☆", "展开阶段线索并建立当前目标。", "更高层阻力浮出水面。", "线索展开", "线索滴灌");
        if (ratio < 0.55)
            return ("承", "主线", "★★★☆☆", "推动主线行动并升级外部压力。", "胜利条件被重新定义。", "冲突升级", string.Empty);
        if (ratio < 0.8)
            return ("转", "峰值", "★★★★☆", "关键真相或反制改变局势。", "主角获得机会但暴露风险。", "反转压迫", string.Empty);
        if (chapterNumber < lastChapter)
            return ("合", "缓冲-代价", "★★★★☆", "整合资源并支付阶段代价。", "最终冲突被推到眼前。", "决战前夜", "峰前代价");
        return ("合", "峰值", "★★★★★", "完成阶段冲突并抛出下一阶段问题。", "新的长期危机或奖励出现。", "阶段收束", string.Empty);
    }

    private async Task<string?> ResolveSourceBookIdAsync(string projectId, string? sourceBookId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(sourceBookId)) return sourceBookId;
        return await _db.Projects.AsNoTracking()
            .Where(x => x.Id == projectId)
            .Select(x => x.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<string?> GetImportedKnowledgeContentAsync(TianmingScope scope, string key, CancellationToken ct)
    {
        var settingKey = BuildKnowledgeSettingKey(scope.ProjectId, scope.SourceBookId, key);
        return await _db.AppSettings.AsNoTracking()
            .Where(x => x.Key == settingKey)
            .Select(x => x.Value)
            .FirstOrDefaultAsync(ct);
    }

    private static string BuildKnowledgeSettingKey(string projectId, string? sourceBookId, string key)
        => $"tianming.kb.{projectId}.{sourceBookId ?? "global"}.{key}";

    private static bool IsKnowledgeFileBound(TianmingScope scope, string key)
        => key switch
        {
            "world_stone" => scope.HasOutline || scope.ChapterPlans.Count > 0,
            "world_rules" => scope.WorldRuleCount > 0,
            "character_archive" => scope.CharacterCount > 0,
            "archive_events" => scope.PlotRuleCount > 0 || scope.FactionCount > 0 || scope.LocationCount > 0,
            "style_sample" => scope.CreativeMaterialCount > 0,
            _ => false
        };

    private async Task<TianmingKnowledgeSnapshot> BuildKnowledgeSnapshotAsync(string projectId, string? sourceBookId, CancellationToken ct)
    {
        var prefix = $"tianming.kb.{projectId}.{sourceBookId ?? "global"}.";
        var imported = await _db.AppSettings.AsNoTracking()
            .Where(x => x.Key.StartsWith(prefix))
            .ToDictionaryAsync(x => x.Key[prefix.Length..], x => x.Value, ct);

        var sections = imported.ToDictionary(
            x => x.Key,
            x => ParseMarkdownSections(x.Value),
            StringComparer.OrdinalIgnoreCase);

        var parsedPlans = ParseChapterPlans(imported.GetValueOrDefault("world_stone"));
        var characterNames = ParseNamedBlocks(imported.GetValueOrDefault("character_archive"));
        var archiveSections = sections.GetValueOrDefault("archive_events") ?? new Dictionary<string, string>();
        var factionNames = ParseNamesFromSection(archiveSections, "势力档案");
        var locationNames = ParseNamesFromSection(archiveSections, "地点档案");
        var allowed = ExtractAllowedEntities(imported.Values)
            .Concat(characterNames)
            .Concat(factionNames)
            .Concat(locationNames)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .ToList();

        return new TianmingKnowledgeSnapshot(imported, sections, parsedPlans, allowed, characterNames, factionNames, locationNames);
    }

    private static Dictionary<string, string> ParseMarkdownSections(string? markdown)
    {
        var sections = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(markdown)) return sections;

        string? current = null;
        var buffer = new StringBuilder();
        foreach (var raw in markdown.Replace("\r\n", "\n").Split('\n'))
        {
            var heading = Regex.Match(raw, @"^\s{0,3}#{1,6}\s+(.+?)\s*$");
            if (heading.Success)
            {
                if (!string.IsNullOrWhiteSpace(current))
                {
                    sections[current] = buffer.ToString().Trim();
                }
                current = NormalizeMarkdownTitle(heading.Groups[1].Value);
                buffer.Clear();
                continue;
            }
            if (!string.IsNullOrWhiteSpace(current)) buffer.AppendLine(raw);
        }

        if (!string.IsNullOrWhiteSpace(current))
        {
            sections[current] = buffer.ToString().Trim();
        }
        return sections;
    }

    private static IReadOnlyList<ChapterPlan> ParseChapterPlans(string? worldStone)
    {
        if (string.IsNullOrWhiteSpace(worldStone)) return Array.Empty<ChapterPlan>();
        var sections = ParseMarkdownSections(worldStone);
        var directory = sections.FirstOrDefault(x => x.Key.Contains("战术执行目录", StringComparison.OrdinalIgnoreCase)).Value;
        if (string.IsNullOrWhiteSpace(directory)) return Array.Empty<ChapterPlan>();

        var plans = new List<ChapterPlan>();
        foreach (var raw in directory.Split('\n'))
        {
            var line = raw.Trim();
            if (!line.StartsWith('|') || line.Contains(":---", StringComparison.Ordinal) || line.Contains("章序", StringComparison.Ordinal)) continue;
            var cells = line.Trim('|').Split('|').Select(x => x.Trim()).ToList();
            if (cells.Count < 2) continue;
            var numberMatch = Regex.Match(cells[0], @"\d+");
            if (!numberMatch.Success) continue;
            var plan = new ChapterPlan
            {
                ChapterNumber = int.Parse(numberMatch.Value),
                ChapterTitle = cells.ElementAtOrDefault(1) ?? string.Empty,
                MacroPhase = cells.ElementAtOrDefault(2) ?? string.Empty,
                TacticalArcId = cells.ElementAtOrDefault(3) ?? string.Empty,
                ChapterType = cells.ElementAtOrDefault(4) ?? string.Empty,
                ConflictScore = cells.ElementAtOrDefault(5) ?? string.Empty,
                CoreEvent = cells.ElementAtOrDefault(6) ?? string.Empty,
                Hook = cells.ElementAtOrDefault(7) ?? string.Empty,
                MainGoal = cells.ElementAtOrDefault(6) ?? string.Empty,
                MainPlotProgress = cells.ElementAtOrDefault(6) ?? string.Empty
            };
            plans.Add(plan);
        }
        return plans.OrderBy(x => x.ChapterNumber).ToList();
    }

    private static IReadOnlyList<string> ParseNamedBlocks(string? markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown)) return Array.Empty<string>();
        return markdown.Split('\n')
            .Select(x => Regex.Match(x.Trim(), @"^#{2,6}\s+(.+)$"))
            .Where(x => x.Success)
            .Select(x => NormalizeMarkdownTitle(x.Groups[1].Value))
            .Where(x => !string.IsNullOrWhiteSpace(x) && !x.Contains("档案", StringComparison.Ordinal))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static IReadOnlyList<string> ParseNamesFromSection(IReadOnlyDictionary<string, string> sections, string sectionName)
    {
        var section = sections.FirstOrDefault(x => x.Key.Contains(sectionName, StringComparison.OrdinalIgnoreCase)).Value;
        return ParseNamedBlocks(section);
    }

    private static IReadOnlyList<string> ExtractAllowedEntities(IEnumerable<string> markdowns)
    {
        var names = new List<string>();
        foreach (var markdown in markdowns)
        {
            foreach (Match match in Regex.Matches(markdown, @"allowed_entities\s*[:：]\s*(.+)", RegexOptions.IgnoreCase))
            {
                names.AddRange(SplitEntityList(match.Groups[1].Value));
            }
            foreach (Match match in Regex.Matches(markdown, @"准入实体\s*[:：]\s*(.+)", RegexOptions.IgnoreCase))
            {
                names.AddRange(SplitEntityList(match.Groups[1].Value));
            }
        }
        return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static IEnumerable<string> SplitEntityList(string value)
        => value
            .Replace("[", string.Empty)
            .Replace("]", string.Empty)
            .Split(new[] { ',', '，', '、', ';', '；', '|', '/', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.Trim('`', '"', '\'', '“', '”'))
            .Where(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 40);

    private static string NormalizeMarkdownTitle(string value)
        => Regex.Replace(value.Trim().Trim('#', '*', '`'), @"\s+", " ");

    private async Task<ChapterPlan> LoadPlanByChapterAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        var scope = await LoadScopeAsync(request, ct);
        var number = request.ChapterNumber ?? request.StartChapterNumber
                     ?? throw new InvalidOperationException("章节号不能为空。");
        return scope.ChapterPlans.FirstOrDefault(x => x.ChapterNumber == number)
               ?? throw new InvalidOperationException($"未找到第 {number} 章章节计划。");
    }

    private static List<string> ValidateDirectoryScope(TianmingScope scope, int? startNumber, int? endNumber)
    {
        var errors = ValidateRequiredKnowledge(scope, requireWorldStone: true);
        var plans = FilterPlans(scope.ChapterPlans, startNumber, endNumber);
        if (plans.Count == 0)
        {
            errors.Add("FATAL_ERROR: Directory_Blueprint_Missing，指定范围内没有章节计划。");
            return errors;
        }

        var numbers = plans.Select(x => x.ChapterNumber).OrderBy(x => x).ToList();
        var expected = Enumerable.Range(numbers.First(), numbers.Last() - numbers.First() + 1).ToList();
        var missing = expected.Except(numbers).ToList();
        if (missing.Count > 0)
        {
            errors.Add($"FATAL_ERROR: Directory_Continuity_Broken，缺失章节：{string.Join("、", missing.Take(30))}。");
        }

        foreach (var plan in plans)
        {
            if (string.IsNullOrWhiteSpace(plan.ChapterType))
                errors.Add($"ERROR: 第 {plan.ChapterNumber} 章缺少章节类型。");
            if (string.IsNullOrWhiteSpace(plan.ConflictScore))
                errors.Add($"ERROR: 第 {plan.ChapterNumber} 章缺少冲突值。");
            if (string.IsNullOrWhiteSpace(FirstNonEmpty(plan.CoreEvent, plan.MainGoal, plan.MainPlotProgress)))
                errors.Add($"ERROR: 第 {plan.ChapterNumber} 章缺少核心事件。");
            if (string.IsNullOrWhiteSpace(FirstNonEmpty(plan.TemporalAnchor, plan.SpatialAnchor, plan.TimelineCoordinate)))
                errors.Add($"ERROR: 第 {plan.ChapterNumber} 章缺少时空锚点。");
            var invalid = FindInvalidEntities(plan, scope);
            if (invalid.Count > 0)
                errors.Add($"FATAL_ERROR: Entity_Whitelist_Violation，第 {plan.ChapterNumber} 章存在未准入实体：{JoinList(invalid)}。");
        }

        var bufferCount = plans.Count(x => IsBufferChapter(x));
        if (plans.Count >= 10)
        {
            var ratio = bufferCount * 100.0 / plans.Count;
            if (ratio is < 36 or > 38)
                errors.Add($"WARNING: Buffer_Ratio_Out_Of_Range，当前目录区间缓冲章节占比 {Math.Round(ratio, 1)}%，全书体检建议接近 37% ±1%。");
        }

        return errors;
    }

    private static List<string> ValidateDraftPlan(ChapterPlan plan, TianmingScope scope)
    {
        var errors = ValidateRequiredKnowledge(scope, requireWorldStone: true);
        if (!scope.Knowledge.HasWorldStoneBlueprint && scope.Knowledge.IsAnyImported)
        {
            errors.Add("FATAL_ERROR: Blueprint_Mismatch，未在《世界基石.md # 战术执行目录》中锁定章节蓝图。");
        }
        if (string.IsNullOrWhiteSpace(FirstNonEmpty(plan.CoreEvent, plan.MainGoal, plan.MainPlotProgress)))
            errors.Add($"FATAL_ERROR: Blueprint_Mismatch，第 {plan.ChapterNumber} 章缺少章节核心。");
        if (string.IsNullOrWhiteSpace(plan.Hook))
            errors.Add($"ERROR: Draft_Hook_Missing，第 {plan.ChapterNumber} 章缺少悬念钩子。");
        var invalid = FindInvalidEntities(plan, scope);
        if (invalid.Count > 0)
            errors.Add($"FATAL_ERROR: Entity_Whitelist_Violation，第 {plan.ChapterNumber} 章存在未准入实体：{JoinList(invalid)}。");
        return errors;
    }

    private static List<string> ValidateManifestPlan(ChapterPlan? plan, TianmingScope scope)
    {
        var errors = ValidateRequiredKnowledge(scope, requireWorldStone: true);
        if (plan == null)
        {
            errors.Add("FATAL_ERROR: Manifest_Blueprint_Missing，正文协议未找到当前章节计划。");
            return errors;
        }
        errors.AddRange(ValidateDraftPlan(plan, scope));
        if (string.IsNullOrWhiteSpace(plan.ChapterType))
            errors.Add($"FATAL_ERROR: Render_Type_Missing，第 {plan.ChapterNumber} 章缺少章节类型，无法选择正文渲染引擎。");
        if (string.IsNullOrWhiteSpace(plan.ConflictScore))
            errors.Add($"ERROR: Conflict_Score_Missing，第 {plan.ChapterNumber} 章缺少冲突值。");
        return errors.Distinct().ToList();
    }

    private static List<string> ValidateHealthScope(TianmingScope scope)
    {
        var errors = ValidateRequiredKnowledge(scope, requireWorldStone: true);
        if (scope.ChapterPlans.Count == 0)
        {
            errors.Add("FATAL_ERROR: Health_Check_No_Directory，没有可体检的战术执行目录。");
            return errors;
        }
        errors.AddRange(ValidateDirectoryScope(scope, null, null).Where(x => x.StartsWith("FATAL_ERROR", StringComparison.Ordinal)));
        var dormant = BuildDormantForeshadowingWarning(scope.ChapterPlans);
        if (dormant != "暂无")
            errors.Add($"ERROR: Dormant_Foreshadowing_Warning，{dormant}");
        return errors.Distinct().ToList();
    }

    private static List<string> ValidateRequiredKnowledge(TianmingScope scope, bool requireWorldStone)
    {
        var errors = new List<string>();
        if (requireWorldStone && !scope.Knowledge.HasContent("world_stone") && !scope.HasOutline && scope.ChapterPlans.Count == 0)
            errors.Add("FATAL_ERROR: Knowledge_Missing，缺少《世界基石.md》或数据库大纲/章节计划。");
        if (!scope.Knowledge.HasContent("world_rules") && scope.WorldRuleCount == 0)
            errors.Add("ERROR: Knowledge_Missing，缺少《世界观规则.md》。");
        if (!scope.Knowledge.HasContent("character_archive") && scope.CharacterCount == 0)
            errors.Add("ERROR: Knowledge_Missing，缺少《角色档案.md》。");
        if (!scope.Knowledge.HasContent("archive_events") && scope.PlotRuleCount == 0 && scope.FactionCount == 0 && scope.LocationCount == 0)
            errors.Add("ERROR: Knowledge_Missing，缺少《档案事件.md》。");
        if (!scope.Knowledge.HasContent("style_sample") && scope.CreativeMaterialCount == 0)
            errors.Add("ERROR: Knowledge_Missing，缺少《文风样本.md》。");
        return errors;
    }

    private static IReadOnlyList<ChapterPlan> FilterPlans(IReadOnlyList<ChapterPlan> plans, int? startNumber, int? endNumber)
    {
        if (plans.Count == 0) return plans;
        var start = startNumber ?? plans.Min(x => x.ChapterNumber);
        var end = endNumber ?? startNumber ?? plans.Max(x => x.ChapterNumber);
        if (end < start) (start, end) = (end, start);
        return plans.Where(x => x.ChapterNumber >= start && x.ChapterNumber <= end).OrderBy(x => x.ChapterNumber).ToList();
    }

    private static IReadOnlyList<string> FindInvalidEntities(ChapterPlan plan, TianmingScope scope)
    {
        if (scope.Knowledge.AllowedEntities.Count == 0) return Array.Empty<string>();
        var referenced = plan.AllowedEntities
            .Concat(plan.ReferencedCharacterNames)
            .Concat(plan.ReferencedFactionNames)
            .Concat(plan.ReferencedLocationNames)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (referenced.Count == 0) return Array.Empty<string>();
        return referenced
            .Where(x => !scope.Knowledge.AllowedEntities.Contains(x, StringComparer.OrdinalIgnoreCase))
            .ToList();
    }

    private static bool IsBufferChapter(ChapterPlan plan)
        => plan.ChapterType.Contains("缓冲", StringComparison.OrdinalIgnoreCase)
           || plan.BufferRole.Contains("缓冲", StringComparison.OrdinalIgnoreCase);

    private static bool IsFatalIssue(string issue)
        => issue.StartsWith("FATAL_ERROR", StringComparison.OrdinalIgnoreCase);

    private async Task<ChapterDto> LoadChapterAsync(TianmingProtocolRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.ChapterId))
        {
            var byId = await _db.Chapters.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ChapterId, ct)
                ?? throw new InvalidOperationException("章节不存在。");
            return new(byId.Id, byId.ProjectId, byId.VolumeId, byId.ChapterNumber, byId.Title, byId.WordCount, byId.Summary, string.Empty, byId.ContentFilePath, byId.Status, byId.CreatedAt, byId.UpdatedAt);
        }

        if (string.IsNullOrWhiteSpace(request.ProjectId))
            throw new InvalidOperationException("项目 ID 不能为空。");
        var number = request.ChapterNumber ?? request.StartChapterNumber
                     ?? throw new InvalidOperationException("章节号不能为空。");
        var chapter = await _db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == request.ProjectId && x.ChapterNumber == number)
            .OrderBy(x => x.ChapterNumber)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException($"未找到第 {number} 章真实章节。");
        return new(chapter.Id, chapter.ProjectId, chapter.VolumeId, chapter.ChapterNumber, chapter.Title, chapter.WordCount, chapter.Summary, string.Empty, chapter.ContentFilePath, chapter.Status, chapter.CreatedAt, chapter.UpdatedAt);
    }

    private static Task<int> CountAsync<T>(IQueryable<T> query, CancellationToken ct) where T : class
        => query.CountAsync(ct);

    private static TianmingProtocolResultDto Result(
        string key,
        string command,
        string status,
        string title,
        string content,
        Dictionary<string, string> metadata)
        => new(key, command, Protocols.First(x => x.Key == key).ApiId, status, title, content, metadata, DateTime.UtcNow);

    private static TianmingProtocolResultDto Fatal(
        string key,
        string command,
        string title,
        IReadOnlyList<string> errors,
        Dictionary<string, string> metadata)
    {
        var sb = new StringBuilder();
        sb.AppendLine("【协议门禁未通过】");
        sb.AppendLine();
        foreach (var error in errors)
        {
            sb.AppendLine($"- {error}");
        }
        return Result(key, command, "fatal", title, sb.ToString(), metadata);
    }

    private static string NormalizeCommand(string command)
    {
        var value = command.Trim().ToLowerInvariant();
        if (value is "initialize" or "init" or "初始化") return "initialize";
        if (value.Contains("大纲") || value == "outline") return "outline";
        if (value.Contains("规划") || value == "plan") return "plan";
        if (value.Contains("目录") || value == "directory") return "directory";
        if (value.Contains("草案") || value == "draft") return "draft";
        if (value.Contains("正文") || value is "manifest" or "main_body") return "manifest";
        if (value.Contains("体检") || value is "health" or "health_check") return "health_check";
        if (value.Contains("存档") || value == "archive") return "archive";
        return value;
    }

    private static string EstimatePhase(int chapter, int start, int end)
    {
        var ratio = (chapter - start + 1) / (double)Math.Max(1, end - start + 1);
        if (ratio < 0.25) return "起";
        if (ratio < 0.55) return "承";
        if (ratio < 0.8) return "转";
        return "合";
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string TrimText(string value, int maxLength)
    {
        value = FirstNonEmpty(value, "未填写");
        return value.Length <= maxLength ? value : value[..maxLength];
    }

    private static void AppendLine(StringBuilder sb, string label, string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        sb.AppendLine($"- {label}：{value.Trim()}");
    }

    private static string JoinList(IEnumerable<string> values)
        => string.Join("、", values.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()));

    private static string BuildDormantForeshadowingWarning(IReadOnlyList<ChapterPlan> plans)
    {
        var highTier = plans
            .Where(x => x.ForeshadowingTier is "Tier-1" or "Tier-2")
            .OrderBy(x => x.ChapterNumber)
            .ToList();
        var dormant = highTier
            .Where(x => !x.ForeshadowingRole.Contains("回收", StringComparison.OrdinalIgnoreCase))
            .Where(x => plans.Any(p => p.ChapterNumber > x.ChapterNumber + 30))
            .Take(10)
            .Select(x => $"第{x.ChapterNumber}章 {x.ForeshadowingTier}")
            .ToList();
        return dormant.Count == 0 ? "暂无" : string.Join("；", dormant);
    }

    private sealed record TianmingScope(
        string ProjectId,
        string ProjectName,
        string ProjectDescription,
        string? SourceBookId,
        string SourceBookLabel,
        int WorldRuleCount,
        int CharacterCount,
        int FactionCount,
        int LocationCount,
        int PlotRuleCount,
        int CreativeMaterialCount,
        bool HasOutline,
        TianmingKnowledgeSnapshot Knowledge,
        IReadOnlyList<ChapterPlan> ChapterPlans,
        Dictionary<string, string> Metadata);

    private sealed record TianmingKnowledgeSnapshot(
        IReadOnlyDictionary<string, string> Contents,
        IReadOnlyDictionary<string, Dictionary<string, string>> Sections,
        IReadOnlyList<ChapterPlan> ParsedChapterPlans,
        IReadOnlyList<string> AllowedEntities,
        IReadOnlyList<string> CharacterNames,
        IReadOnlyList<string> FactionNames,
        IReadOnlyList<string> LocationNames)
    {
        public bool IsAnyImported => Contents.Count > 0;
        public bool HasWorldStoneBlueprint => ParsedChapterPlans.Count > 0;

        public bool HasContent(string key)
            => Contents.TryGetValue(key, out var content) && !string.IsNullOrWhiteSpace(content);

        public string GetContent(string key)
            => Contents.TryGetValue(key, out var content) ? content : string.Empty;

        public string GetSection(string key, string sectionName)
        {
            if (!Sections.TryGetValue(key, out var sections)) return string.Empty;
            return sections.FirstOrDefault(x => x.Key.Contains(sectionName, StringComparison.OrdinalIgnoreCase)).Value ?? string.Empty;
        }
    }
}
