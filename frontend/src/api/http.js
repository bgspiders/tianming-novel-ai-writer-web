import axios from 'axios';
const http = axios.create({
    baseURL: '',
    timeout: 60_000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});
function normalizeProblemMessage(data) {
    if (!data)
        return undefined;
    if (data.rootCauseMessage
        && data.detail?.includes('An error occurred while saving the entity changes')) {
        return `${data.detail} 根因：${data.rootCauseMessage}`;
    }
    if (data.detail)
        return data.detail;
    if (data.title === 'One or more validation errors occurred.') {
        return '请求参数验证失败，请检查表单内容后再提交。';
    }
    return data.title;
}
http.interceptors.response.use((resp) => resp, (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        window.location.assign(`/login?redirect=${redirect}`);
    }
    // 简单错误归一：尽量给前端展示后端 ProblemDetails.detail
    const data = err.response?.data;
    const message = normalizeProblemMessage(data);
    if (message)
        err.message = message;
    return Promise.reject(err);
});
export default http;
