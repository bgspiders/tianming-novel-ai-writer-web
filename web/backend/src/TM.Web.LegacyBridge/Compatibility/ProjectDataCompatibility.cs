using TM.Services.Modules.ProjectData.Models.Design.Characters;
using TM.Services.Modules.ProjectData.Models.Guides;
using TM.Services.Modules.ProjectData.Models.Index;
using TM.Services.Modules.ProjectData.Models.Navigation;
using TM.Services.Modules.ProjectData.Models.TaskContexts;

namespace TM.Services.Modules.ProjectData.Helpers
{
    public static class NavigationConfigParser
    {
        public static List<ModuleInfo> GetModulesByType(string moduleType) => new();

        public static List<ModuleInfo> GetFunctionsBySubModule(string moduleType, string subModule) => new();

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

        public Task<ContentGuide?> GetContentGuideAsync() => Task.FromResult<ContentGuide?>(new ContentGuide());

        public Task<(List<IndexItem> Direct, List<IndexItem> Indirect)> GetRelatedEntitiesAsync(
            string focusId,
            string targetLayer,
            string? sourceBookId = null)
        {
            return Task.FromResult((new List<IndexItem>(), new List<IndexItem>()));
        }

        public Task<List<CharacterRulesData>> GetAllCharactersAsync() => Task.FromResult(new List<CharacterRulesData>());

        public Task<BlueprintTaskContext> BuildBlueprintContextAsync(string chapterId) => Task.FromResult(new BlueprintTaskContext());

        public Task<ContentTaskContext> BuildContentContextAsync(string chapterId) => Task.FromResult(new ContentTaskContext());
    }
}
