using TM.Web.Application.Dtos.Import;

namespace TM.Web.Application.Services;

public interface IDataImportService
{
    /// <summary>
    /// 从原 WPF 项目的 Storage 目录批量导入到当前 SQLite。
    /// 幂等：同 Id 主键 upsert。
    /// </summary>
    Task<ImportReport> ImportFromAsync(ImportRequest request, CancellationToken ct = default);
}
