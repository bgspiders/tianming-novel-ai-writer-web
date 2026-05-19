import axios from 'axios';
const http = axios.create({
    baseURL: '',
    timeout: 60_000,
    headers: {
        'Content-Type': 'application/json'
    }
});
http.interceptors.response.use((resp) => resp, (err) => {
    // 简单错误归一：尽量给前端展示后端 ProblemDetails.detail
    const data = err.response?.data;
    if (data?.detail) {
        err.message = data.detail;
    }
    else if (data?.title) {
        err.message = data.title;
    }
    return Promise.reject(err);
});
export default http;
