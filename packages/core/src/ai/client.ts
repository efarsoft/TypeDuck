import { AiApiError, type AiConfig, type AiMessage, type StreamOptions } from './types'

/** 去掉 base URL 尾部斜杠，拼接接口路径 */
function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}

interface ErrorBody {
  error?: { message?: string }
  message?: string
}

/** 把 fetch/HTTP 错误翻译成用户能看懂的提示 */
function toApiError(status: number, bodyText: string): AiApiError {
  let apiMsg = ''
  try {
    const parsed = JSON.parse(bodyText) as ErrorBody
    apiMsg = parsed.error?.message ?? parsed.message ?? ''
  } catch {
    /* 非 JSON 错误体，忽略 */
  }
  if (apiMsg) return new AiApiError(apiMsg, status)
  const hint =
    status === 401
      ? 'API Key 无效或未填，请检查 AI 设置'
      : status === 404
        ? '接口地址或模型名不存在，请检查 Base URL 与模型'
        : status === 429
          ? '请求太频繁或额度不足，稍后再试'
          : `请求失败（HTTP ${status}）`
  return new AiApiError(hint, status)
}

/**
 * OpenAI 兼容流式对话：POST {base}/chat/completions，解析 SSE 增量。
 * 返回完整回复文本；onDelta 每段增量回调一次。
 */
export async function streamChat(
  config: AiConfig,
  messages: AiMessage[],
  options: StreamOptions = {},
): Promise<string> {
  if (!config.baseUrl) throw new AiApiError('未配置 Base URL，请先在 AI 设置中填写', 0)
  if (!config.apiKey) throw new AiApiError('未配置 API Key，请先在 AI 设置中填写', 0)

  let res: Response
  try {
    res = await fetch(joinUrl(config.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, stream: true }),
      signal: options.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new AiApiError('网络错误：无法连接接口（断网、跨域受限或地址错误）', 0)
  }

  if (!res.ok) throw toApiError(res.status, await res.text())

  const reader = res.body?.getReader()
  if (!reader) throw new AiApiError('当前环境不支持流式读取', 0)

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  // SSE 按行解析：`data: {chunk}` 增量、`data: [DONE]` 结束；
  // 智谱/DeepSeek 思考模式会额外送 reasoning_content 字段，只取 content 即可
  const consumeLine = (line: string) => {
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    try {
      const chunk = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[]
      }
      const text = chunk.choices?.[0]?.delta?.content
      if (text) {
        full += text
        options.onDelta?.(text)
      }
    } catch {
      /* 跳过无法解析的行（心跳、注释等） */
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) consumeLine(line.trimEnd())
  }
  if (buffer) consumeLine(buffer.trimEnd())

  return full
}

/** 拉取模型列表（OpenAI 兼容 GET /models），用于设置页下拉 */
export async function listModels(config: AiConfig): Promise<string[]> {
  if (!config.baseUrl || !config.apiKey) throw new AiApiError('请先填写 Base URL 和 API Key', 0)
  let res: Response
  try {
    res = await fetch(joinUrl(config.baseUrl, '/models'), {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
  } catch {
    throw new AiApiError('网络错误：无法连接接口（断网、跨域受限或地址错误）', 0)
  }
  if (!res.ok) throw toApiError(res.status, await res.text())
  const data = (await res.json()) as { data?: { id?: string }[] }
  const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => !!id)
  return ids.sort()
}
