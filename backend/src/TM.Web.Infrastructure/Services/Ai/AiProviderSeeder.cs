using Microsoft.EntityFrameworkCore;
using TM.Web.Domain.Entities.AI;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Ai;

/// <summary>
/// 内置 AI Provider 与代表模型的 Seed。仅在表首次为空时插入。
/// 模型清单是阶段 0 的常见默认值；用户可在 UI 中增删改。
/// </summary>
public static class AiProviderSeeder
{
    private record SeedProvider(string Code, string Name, string Endpoint, IReadOnlyList<SeedModel> Models);
    private record SeedModel(string Code, string Name, int ContextWindow, int MaxOutputTokens, bool Vision = false, bool Tools = true);

    private static readonly IReadOnlyList<SeedProvider> Seeds = new SeedProvider[]
    {
        new("openai", "OpenAI", "https://api.openai.com/v1", new SeedModel[]
        {
            new("gpt-4o", "GPT-4o", 128000, 16384, Vision: true),
            new("gpt-4o-mini", "GPT-4o mini", 128000, 16384, Vision: true),
            new("o3-mini", "o3-mini", 200000, 100000, Vision: false),
        }),
        new("anthropic", "Anthropic", "https://api.anthropic.com/v1", new SeedModel[]
        {
            new("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", 200000, 8192, Vision: true),
            new("claude-3-5-haiku-20241022", "Claude 3.5 Haiku", 200000, 8192),
            new("claude-3-opus-20240229", "Claude 3 Opus", 200000, 4096, Vision: true),
        }),
        new("gemini", "Google Gemini", "https://generativelanguage.googleapis.com/v1beta", new SeedModel[]
        {
            new("gemini-2.0-flash-exp", "Gemini 2.0 Flash", 1048576, 8192, Vision: true),
            new("gemini-1.5-pro", "Gemini 1.5 Pro", 2097152, 8192, Vision: true),
        }),
        new("deepseek", "DeepSeek", "https://api.deepseek.com/v1", new SeedModel[]
        {
            new("deepseek-chat", "DeepSeek V3", 64000, 8192),
            new("deepseek-reasoner", "DeepSeek R1", 64000, 8192),
        }),
        new("moonshot", "Moonshot", "https://api.moonshot.cn/v1", new SeedModel[]
        {
            new("moonshot-v1-128k", "Moonshot v1 128K", 128000, 8192),
            new("moonshot-v1-32k", "Moonshot v1 32K", 32000, 4096),
        }),
    };

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.AiProviders.AnyAsync(ct))
            return;

        var sortOrder = 0;
        foreach (var seed in Seeds)
        {
            var provider = new AiProvider
            {
                Code = seed.Code,
                Name = seed.Name,
                DefaultEndpoint = seed.Endpoint,
                IsBuiltIn = true,
                IsEnabled = true,
                SortOrder = sortOrder++,
            };
            db.AiProviders.Add(provider);

            var modelOrder = 0;
            foreach (var m in seed.Models)
            {
                db.AiModels.Add(new AiModel
                {
                    ProviderId = provider.Id,
                    Code = m.Code,
                    Name = m.Name,
                    ContextWindow = m.ContextWindow,
                    MaxOutputTokens = m.MaxOutputTokens,
                    Capabilities = $"{{\"vision\":{m.Vision.ToString().ToLowerInvariant()},\"tools\":{m.Tools.ToString().ToLowerInvariant()},\"streaming\":true}}",
                    IsEnabled = true,
                    SortOrder = modelOrder++,
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
