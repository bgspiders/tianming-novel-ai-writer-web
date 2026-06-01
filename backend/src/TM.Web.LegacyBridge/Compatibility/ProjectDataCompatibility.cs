using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace TM.Services.Modules.ProjectData.Helpers
{
    public static class NavigationConfigParser
    {
        public static List<Models.Navigation.ModuleInfo> GetModulesByType(string moduleType) => new();

        public static List<Models.Navigation.ModuleInfo> GetFunctionsBySubModule(string moduleType, string subModule) => new();

        public static List<(string SubModule, string DisplayName)> GetSubModules(string moduleType) => new();

        public static string GetStoragePath(string functionName) => string.Empty;
    }
}

namespace TM.Services.Modules.ProjectData.Implementations
{
    public class GuideContextService
    {
        public static event EventHandler? CacheInvalidated;

        public static void RaiseCacheInvalidated() => CacheInvalidated?.Invoke(null, EventArgs.Empty);

        public Task<Models.Guides.ContentGuide?> GetContentGuideAsync()
            => Task.FromResult<Models.Guides.ContentGuide?>(new Models.Guides.ContentGuide());

        public Task<(List<Models.Index.IndexItem> Direct, List<Models.Index.IndexItem> Indirect)> GetRelatedEntitiesAsync(
            string focusId,
            string targetLayer,
            string? sourceBookId = null)
        {
            return Task.FromResult((new List<Models.Index.IndexItem>(), new List<Models.Index.IndexItem>()));
        }

        public Task<List<Models.Design.Characters.CharacterRulesData>> GetAllCharactersAsync()
            => Task.FromResult(new List<Models.Design.Characters.CharacterRulesData>());

        public Task<Models.TaskContexts.BlueprintTaskContext> BuildBlueprintContextAsync(string chapterId)
            => Task.FromResult(new Models.TaskContexts.BlueprintTaskContext());

        public Task<Models.TaskContexts.ContentTaskContext> BuildContentContextAsync(string chapterId)
            => Task.FromResult(new Models.TaskContexts.ContentTaskContext());
    }
}

namespace TM.Services.Modules.ProjectData.Models.Design.Characters
{
    public sealed class CharacterRulesData
    {
    }
}

namespace TM.Services.Modules.ProjectData.Models.Guides
{
    public sealed class ContentGuide
    {
    }
}

namespace TM.Services.Modules.ProjectData.Models.Index
{
    public sealed class IndexItem
    {
    }
}

namespace TM.Services.Modules.ProjectData.Models.Navigation
{
    public sealed class ModuleInfo
    {
    }
}

namespace TM.Services.Modules.ProjectData.Models.TaskContexts
{
    public sealed class BlueprintTaskContext
    {
    }

    public sealed class ContentTaskContext
    {
    }
}
