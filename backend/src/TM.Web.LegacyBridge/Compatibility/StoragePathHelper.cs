using System;
using System.IO;
using System.Linq;

namespace TM.Framework.Common.Helpers.Storage;

public static class StoragePathHelper
{
    private static string _basePath = AppContext.BaseDirectory;

    public static string BasePath => _basePath;

    public static void SetBasePath(string basePath)
    {
        if (string.IsNullOrWhiteSpace(basePath))
        {
            return;
        }

        _basePath = Path.GetFullPath(basePath);
        Directory.CreateDirectory(_basePath);
    }

    public static string GetPath(params string[] paths)
    {
        if (paths.Length == 0)
        {
            return _basePath;
        }

        return Path.Combine(new[] { _basePath }.Concat(paths).ToArray());
    }
}
