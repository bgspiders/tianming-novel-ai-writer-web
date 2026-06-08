using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Dtos.Validation;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class ChapterDraftPromptRecallTests
{
    [Fact]
    public async Task GenerateDraftAsync_adds_editor_related_context_before_user_prompt_and_filters_future_chapters()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var current = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 5,
            Title = "第五章",
            Summary = "当前章节",
            ContentFilePath = "projects/p/chapters/005.md",
            Status = "planned"
        };
        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(current);
        await db.SaveChangesAsync();

        var longSummary = new string('摘', 10_000) + "SUMMARY_TAIL_SHOULD_BE_TRUNCATED";
        var longSnippet = new string('段', 10_000) + "SNIPPET_TAIL_SHOULD_BE_TRUNCATED";
        var editor = new FakeEditorService(new EditorChapterAssistDto(
            ToChapterDto(current),
            new[]
            {
                Related(project.Id, volume.Id, 3, "第三章旧线索", longSummary, longSnippet),
                Related(project.Id, volume.Id, 5, "第五章当前章节", "不应进入当前章节摘要", "不应进入当前章节片段"),
                Related(project.Id, volume.Id, 8, "第八章未来章节", "未来章节摘要", "未来章节片段")
            }));
        var ai = new CapturingAiCompletionService();
        var service = CreateService(db, ai, editor);

        await service.GenerateDraftAsync(new ChapterDraftRequest
        {
            RunId = "run-1",
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterId = current.Id,
            Endpoint = "https://example.invalid/v1/chat/completions",
            ApiKey = "test-key",
            Model = "test-model",
            Prompt = "写出第五章正文",
            MaxRewriteAttempts = 0,
            SaveToChapter = false
        });

        ai.CapturedPrompt.Should().Contain("自动召回的相关章节上下文");
        ai.CapturedPrompt.IndexOf("自动召回的相关章节上下文", StringComparison.Ordinal)
            .Should().BeLessThan(ai.CapturedPrompt.IndexOf("# 用户生成提示词", StringComparison.Ordinal));
        ai.CapturedPrompt.Should().Contain("第三章旧线索");
        ai.CapturedPrompt.Should().NotContain("第八章未来章节");
        ai.CapturedPrompt.Should().NotContain("未来章节摘要");
        ai.CapturedPrompt.Should().NotContain("第五章当前章节");
        ai.CapturedPrompt.Should().NotContain("SUMMARY_TAIL_SHOULD_BE_TRUNCATED");
        ai.CapturedPrompt.Should().NotContain("SNIPPET_TAIL_SHOULD_BE_TRUNCATED");
        db.PromptRunSnapshots.Should().ContainSingle(x =>
            x.RunId == "run-1"
            && x.ProjectId == project.Id
            && x.ChapterId == current.Id
            && x.Source == "chapter_draft"
            && x.ContextHash.Length == 64
            && x.OutputSummary.Contains("生成正文"));
    }

    private static ChapterDraftService CreateService(
        AppDbContext db,
        IAiCompletionService ai,
        IEditorService editor)
        => new(
            ai,
            new FakeAiApiKeyService(),
            new FakeChapterService(),
            editor,
            new PassingGenerationGateService(),
            new ContextPackagingService(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build()),
            new GenerationStateService(db),
            new NoOpValidationService(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build(),
            db,
            NullLogger<ChapterDraftService>.Instance);

    private static ChapterDto ToChapterDto(Chapter chapter)
        => new(
            chapter.Id,
            chapter.ProjectId,
            chapter.VolumeId,
            chapter.ChapterNumber,
            chapter.Title,
            chapter.WordCount,
            chapter.Summary,
            string.Empty,
            chapter.ContentFilePath,
            chapter.Status,
            chapter.CreatedAt,
            chapter.UpdatedAt);

    private static EditorSearchResultDto Related(
        string projectId,
        string volumeId,
        int chapterNumber,
        string title,
        string summary,
        string snippet)
        => new(
            $"chapter-{chapterNumber}",
            projectId,
            volumeId,
            chapterNumber,
            title,
            summary,
            snippet,
            10,
            new[] { "星门" });

    private sealed class CapturingAiCompletionService : IAiCompletionService
    {
        public string CapturedPrompt { get; private set; } = string.Empty;

        public Task<AiTestResult> StreamAsync(AiTestRequest request, CancellationToken ct = default)
        {
            CapturedPrompt = request.Prompt;
            return Task.FromResult(new AiTestResult
            {
                RunId = request.RunId,
                Model = request.Model,
                Content = "生成正文",
                CharCount = 4,
                ChunkCount = 1,
                FinishReason = "stop",
                ElapsedMs = 1
            });
        }

        public Task<AiTestResult> CompleteAsync(AiTestRequest request, CancellationToken ct = default)
            => StreamAsync(request, ct);
    }

    private sealed class FakeEditorService : IEditorService
    {
        private readonly EditorChapterAssistDto _assist;

        public FakeEditorService(EditorChapterAssistDto assist)
        {
            _assist = assist;
        }

        public Task<IReadOnlyList<EditorSearchResultDto>> SearchAsync(EditorSearchRequest request, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<EditorSearchResultDto>>(Array.Empty<EditorSearchResultDto>());

        public Task<EditorChapterAssistDto?> GetChapterAssistAsync(string chapterId, int relatedTopK = 6, CancellationToken ct = default)
            => Task.FromResult<EditorChapterAssistDto?>(_assist);

        public Task<ChapterDto> SaveChapterContentAsync(string chapterId, EditorSaveChapterRequest request, CancellationToken ct = default)
            => Task.FromResult(_assist.Chapter);

        public Task<EditorIndexRebuildResultDto> RebuildIndexAsync(string projectId, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<EditorIndexStatusDto> GetIndexStatusAsync(string projectId, CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class PassingGenerationGateService : IGenerationGateService
    {
        public Task<GenerationGateResultDto> ValidateAsync(GenerationGateRequest request, CancellationToken ct = default)
            => Task.FromResult(new GenerationGateResultDto
            {
                Success = true,
                ContentWithoutChanges = request.RawContent
            });
    }

    private sealed class FakeAiApiKeyService : IAiApiKeyService
    {
        public Task<IReadOnlyList<AiApiKeyDto>> ListAsync(string? providerId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<AiApiKeyDto>>(Array.Empty<AiApiKeyDto>());

        public Task<AiApiKeyDto?> GetAsync(string id, CancellationToken ct = default)
            => Task.FromResult<AiApiKeyDto?>(null);

        public Task<AiApiKeyDto> CreateAsync(AiApiKeyCreateDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<AiApiKeyDto> UpdateAsync(string id, AiApiKeyUpdateDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task DeleteAsync(string id, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task<AiApiKeyTestResult> TestAsync(string id, AiApiKeyTestDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<string?> GetPlainKeyAsync(string id, CancellationToken ct = default)
            => Task.FromResult<string?>(null);

        public Task<string?> RotateNextPlainKeyAsync(string providerId, CancellationToken ct = default)
            => Task.FromResult<string?>(null);
    }

    private sealed class FakeChapterService : IChapterService
    {
        public Task<IReadOnlyList<ChapterDto>> ListAsync(string projectId, string? volumeId = null, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ChapterDto>>(Array.Empty<ChapterDto>());

        public Task<ChapterDto?> GetAsync(string id, CancellationToken ct = default)
            => Task.FromResult<ChapterDto?>(null);

        public Task<ChapterDto> CreateAsync(ChapterUpsertDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<ChapterDto> UpdateAsync(string id, ChapterUpsertDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task DeleteAsync(string id, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task<ChapterDto> SaveContentAsync(string id, string content, string status = "drafted", CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class NoOpValidationService : IValidationService
    {
        public Task<ValidationSummaryDto> RunAsync(ValidationRunRequest request, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<ValidationSummaryDto>> ListSummariesAsync(string projectId, int? volumeNumber = null, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ValidationSummaryDto>>(Array.Empty<ValidationSummaryDto>());

        public Task<IReadOnlyList<ValidationReportDto>> ListReportsAsync(string projectId, int? volumeNumber = null, string? chapterId = null, int take = 100, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ValidationReportDto>>(Array.Empty<ValidationReportDto>());

        public Task<ValidationReportStatusUpdateResult> UpdateReportChapterStatusAsync(string reportId, ValidationReportStatusUpdateRequest request, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<FactSnapshotDto> GetFactSnapshotAsync(string projectId, int? volumeNumber = null, CancellationToken ct = default)
            => throw new NotSupportedException();
    }
}
