import axios, { AxiosError, type AxiosInstance } from 'axios'

const http: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json'
  }
})

interface ProblemDetailsPayload {
  detail?: string
  title?: string
  errors?: Record<string, string[]>
}

function normalizeProblemMessage(data?: ProblemDetailsPayload): string | undefined {
  if (!data) return undefined

  if (data.detail) return data.detail

  if (data.title === 'One or more validation errors occurred.') {
    return '请求参数验证失败，请检查表单内容后再提交。'
  }

  return data.title
}

http.interceptors.response.use(
  (resp) => resp,
  (err: AxiosError) => {
    // 简单错误归一：尽量给前端展示后端 ProblemDetails.detail
    const data = err.response?.data as ProblemDetailsPayload | undefined
    const message = normalizeProblemMessage(data)
    if (message) err.message = message
    return Promise.reject(err)
  }
)

export default http
