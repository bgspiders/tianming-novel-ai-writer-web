using System;
using System.IO;
using System.Linq;

namespace TM.Framework.Common.Helpers.Storage
{
    public static class StoragePathHelper
    {
        private static string? _storageRootCache = null;
        private static string? _projectRootCache = null;
        private static string _currentProjectName = "默认项目";
        private static readonly object _cacheLock = new();

        /// <summary>
        /// 由宿主进程在启动时显式设置 Storage 根目录，覆盖原本"按 BaseDirectory 向上查找"的行为。
        /// Web 化场景下由 ASP.NET Core 启动时调用一次：StoragePathHelper.SetBasePath(builder.Configuration["Storage:RootPath"])。
        /// 调用后所有 GetXxx 路径方法都基于此根目录。
        /// </summary>
        public static void SetBasePath(string absoluteRoot)
        {
            if (string.IsNullOrWhiteSpace(absoluteRoot))
                throw new ArgumentException("absoluteRoot 不能为空", nameof(absoluteRoot));

            if (!Path.IsPathRooted(absoluteRoot))
                absoluteRoot = Path.GetFullPath(absoluteRoot);

            lock (_cacheLock)
            {
                Directory.CreateDirectory(absoluteRoot);
                _storageRootCache = absoluteRoot;
                _projectRootCache = Directory.GetParent(absoluteRoot)?.FullName ?? absoluteRoot;
            }
        }

        public static event Action<string, string>? CurrentProjectChanging;
        public static event Action<string, string>? CurrentProjectChanged;

        public static string CurrentProjectName
        {
            get => _currentProjectName;
            set
            {
                if (!string.IsNullOrWhiteSpace(value) && value != _currentProjectName)
                {
                    var oldValue = _currentProjectName;
                    try
                    {
                        CurrentProjectChanging?.Invoke(oldValue, value);
                    }
                    catch (Exception ex)
                    {
                        TM.App.Log($"[StoragePathHelper] CurrentProjectChanging异常: {ex.Message}");
                    }

                    _currentProjectName = value;
                    TM.App.Log($"[StoragePathHelper] 切换当前项目: {value}");

                    try
                    {
                        CurrentProjectChanged?.Invoke(oldValue, value);
                    }
                    catch (Exception ex)
                    {
                        TM.App.Log($"[StoragePathHelper] CurrentProjectChanged异常: {ex.Message}");
                    }
                }
            }
        }

        public static string GetCurrentProjectPath()
        {
            var path = Path.Combine(GetStorageRoot(), "Projects", _currentProjectName);
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectConfigPath()
        {
            var path = Path.Combine(GetCurrentProjectPath(), "Config");
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectConfigPath(string moduleName)
        {
            var path = Path.Combine(GetProjectConfigPath(), moduleName);
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectGeneratedPath()
        {
            var path = Path.Combine(GetCurrentProjectPath(), "Generated");
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectChaptersPath()
        {
            var path = Path.Combine(GetProjectGeneratedPath(), "chapters");
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectCategoriesPath()
        {
            return Path.Combine(GetProjectGeneratedPath(), "categories.json");
        }

        public static string GetProjectValidationPath()
        {
            var path = Path.Combine(GetCurrentProjectPath(), "Validation");
            EnsureDirectoryExists(path);
            return path;
        }

        public static string GetProjectHistoryPath()
        {
            var path = Path.Combine(GetCurrentProjectPath(), "History");
            EnsureDirectoryExists(path);
            return path;
        }

        public static string[] GetAllProjects()
        {
            var projectsPath = Path.Combine(GetStorageRoot(), "Projects");
            if (!Directory.Exists(projectsPath))
            {
                Directory.CreateDirectory(projectsPath);
                return Array.Empty<string>();
            }
            return Directory.GetDirectories(projectsPath)
                .Select(Path.GetFileName)
                .Where(name => !string.IsNullOrEmpty(name))
                .ToArray()!;
        }

        public static bool CreateProject(string projectName)
        {
            if (string.IsNullOrWhiteSpace(projectName))
                return false;

            var projectPath = Path.Combine(GetStorageRoot(), "Projects", projectName);
            if (Directory.Exists(projectPath))
                return false;

            Directory.CreateDirectory(projectPath);
            Directory.CreateDirectory(Path.Combine(projectPath, "Config", "Design"));
            Directory.CreateDirectory(Path.Combine(projectPath, "Config", "Generate"));
            Directory.CreateDirectory(Path.Combine(projectPath, "Generated", "chapters"));
            Directory.CreateDirectory(Path.Combine(projectPath, "Validation", "reports"));
            Directory.CreateDirectory(Path.Combine(projectPath, "History"));

            TM.App.Log($"[StoragePathHelper] 创建新项目: {projectName}");
            return true;
        }

        public static string GetStorageRoot()
        {
            if (_storageRootCache != null)
                return _storageRootCache;

            lock (_cacheLock)
            {
                if (_storageRootCache != null)
                    return _storageRootCache;

            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            TM.App.Log($"[StoragePathHelper] 程序运行目录: {baseDir}");

            var currentDir = new DirectoryInfo(baseDir);
            int level = 0;
            while (currentDir != null && level < 10)
            {
                var storagePath = Path.Combine(currentDir.FullName, "Storage");
                TM.App.Log($"[StoragePathHelper] [{level}] 检查: {storagePath}");

                if (Directory.Exists(storagePath))
                {
                    var frameworkPath = Path.Combine(storagePath, "Framework");
                    if (!Directory.Exists(frameworkPath))
                    {
                        TM.App.Log($"[StoragePathHelper] ⚠️ 跳过（缺少Framework目录）: {storagePath}");
                        currentDir = currentDir.Parent;
                        level++;
                        continue;
                    }

                    var parentDir = currentDir.FullName;
                    var projectMarkers = new[] { "Core", "Framework", "Services", "Modules" };
                    var markerCount = projectMarkers.Count(marker => Directory.Exists(Path.Combine(parentDir, marker)));

                    if (markerCount >= 2)
                    {
                        _storageRootCache = storagePath;
                        TM.App.Log($"[StoragePathHelper] ✅ 找到项目Storage目录: {storagePath}（父目录特征匹配数: {markerCount}）");
                        return _storageRootCache;
                    }
                    else
                    {
                        TM.App.Log($"[StoragePathHelper] ⚠️ 跳过（不在项目根目录）: {storagePath}（特征匹配数: {markerCount}）");
                    }
                }

                currentDir = currentDir.Parent;
                level++;
            }

            var exeStoragePath = Path.Combine(baseDir, "Storage");
            _storageRootCache = exeStoragePath;
            TM.App.Log($"[StoragePathHelper] 使用exe目录下的Storage: {exeStoragePath}");
            return _storageRootCache;
            }
        }

        public static string GetProjectRoot()
        {
            if (_projectRootCache != null)
                return _projectRootCache;

            lock (_cacheLock)
            {
                if (_projectRootCache != null)
                    return _projectRootCache;

            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            TM.App.Log($"[StoragePathHelper] 查找项目根目录，起始位置: {baseDir}");

            var currentDir = new DirectoryInfo(baseDir);
            int level = 0;
            while (currentDir != null && level < 10)
            {
                TM.App.Log($"[StoragePathHelper] [{level}] 检查项目根: {currentDir.FullName}");

                var projectMarkers = new[] { "Core", "Framework", "Services", "Modules" };
                var markerCount = projectMarkers.Count(marker => Directory.Exists(Path.Combine(currentDir.FullName, marker)));

                if (markerCount >= 2)
                {
                    _projectRootCache = currentDir.FullName;
                    TM.App.Log($"[StoragePathHelper] ✅ 找到项目根目录: {_projectRootCache}（特征匹配数: {markerCount}）");
                    return _projectRootCache;
                }

                currentDir = currentDir.Parent;
                level++;
            }
            _projectRootCache = baseDir;
            TM.App.Log($"[StoragePathHelper] 使用程序目录作为项目根: {baseDir}");
            return _projectRootCache;
            }
        }

        public static string GetFrameworkPath(string subPath)
        {
            var path = Path.Combine(GetProjectRoot(), "Framework", subPath);
            return Path.GetFullPath(path);
        }

        public static string GetFrameworkStoragePath(string subPath)
        {
            var path = Path.Combine(GetStorageRoot(), "Framework", subPath);
            return Path.GetFullPath(path);
        }

        public static string GetServicesStoragePath(string subPath)
        {
            var path = Path.Combine(GetStorageRoot(), "Services", subPath);
            return Path.GetFullPath(path);
        }

        public static string GetModulesStoragePath(string subPath)
        {
            var path = Path.Combine(GetStorageRoot(), "Modules", subPath);
            return Path.GetFullPath(path);
        }

        public static void EnsureDirectoryExists(string path)
        {
            if (!Directory.Exists(path))
            {
                Directory.CreateDirectory(path);
                TM.App.Log($"[StoragePathHelper] 创建目录: {path}");
            }
        }

        public static string GetFilePath(string layer, string subPath, string fileName)
        {
            string basePath = layer.ToLower() switch
            {
                "framework" => GetFrameworkStoragePath(subPath),
                "services" => GetServicesStoragePath(subPath),
                "modules" => GetModulesStoragePath(subPath),
                _ => throw new ArgumentException($"不支持的层级: {layer}", nameof(layer))
            };

            EnsureDirectoryExists(basePath);
            return Path.Combine(basePath, fileName);
        }

        public static void ClearCache()
        {
            _storageRootCache = null;
            _projectRootCache = null;
            TM.App.Log("[StoragePathHelper] 已清除所有路径缓存");
        }
    }
}

