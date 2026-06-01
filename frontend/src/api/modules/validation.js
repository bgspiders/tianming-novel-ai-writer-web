import http from '../http';
export async function runValidation(input) {
    const { data } = await http.post('/api/validation/run', input);
    return data;
}
export async function listValidationSummaries(projectId, volumeNumber) {
    const params = { projectId };
    if (volumeNumber)
        params.volumeNumber = volumeNumber;
    const { data } = await http.get('/api/validation/summaries', { params });
    return data;
}
export async function listValidationReports(projectId, volumeNumber, chapterId, take = 100) {
    const params = { projectId, take };
    if (volumeNumber)
        params.volumeNumber = volumeNumber;
    if (chapterId)
        params.chapterId = chapterId;
    const { data } = await http.get('/api/validation/reports', { params });
    return data;
}
export async function updateValidationReportChapterStatus(reportId, status, note) {
    const { data } = await http.put(`/api/validation/reports/${reportId}/chapter-status`, { status, note });
    return data;
}
export async function getFactSnapshot(projectId, volumeNumber) {
    const params = { projectId };
    if (volumeNumber)
        params.volumeNumber = volumeNumber;
    const { data } = await http.get('/api/validation/facts', { params });
    return data;
}
