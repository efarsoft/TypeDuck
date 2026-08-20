/** BYOK AI 接入：只走一套 OpenAI 兼容协议（/chat/completions + SSE），四家厂商 + 自定义 */

export interface AiConfig {
  /** 供应商预设 id，见 presets.ts；custom 表示自定义端点 */
  providerId: string
  /** OpenAI 兼容 base URL，如 https://api.deepseek.com */
  baseUrl: string
  /** 用户自己的 API Key，仅存本地 */
  apiKey: string
  /** 模型 id，如 deepseek-v4-flash */
  model: string
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamOptions {
  signal?: AbortSignal
  /** 每收到一段增量文本回调一次 */
  onDelta?: (text: string) => void
}

export class AiApiError extends Error {
  /** HTTP 状态码；0 表示网络层失败（断网/跨域被拦截） */
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiApiError'
    this.status = status
  }
}
