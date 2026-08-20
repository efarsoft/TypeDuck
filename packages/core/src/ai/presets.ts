import type { AiConfig } from './types'

export interface AiProviderPreset {
  id: string
  name: string
  baseUrl: string
  /** 预置模型（按推荐度排序，第一个为默认）；实际可选以「获取模型列表」为准 */
  models: string[]
  keyUrl: string
  note?: string
}

/**
 * 四家厂商均为 OpenAI 兼容协议，差异只有 base URL / model id / Key。
 * 各家均支持 GET /models 拉取列表（百炼个别模型不入列表，以下拉 + 手填兜底）。
 */
export const AI_PRESETS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'flash 便宜量足，写作用它够；pro 是旗舰',
  },
  {
    id: 'qwen',
    name: '通义千问（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen3-max', 'qwen3-flash'],
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
    note: 'qwen-plus 为稳定别名，始终指向当前高性价比版本',
  },
  {
    id: 'glm',
    name: '智谱 GLM（BigModel）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.3', 'glm-5.2', 'glm-5-turbo'],
    keyUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
    note: '注意与 Coding Plan 专用端点的 Key 不通用',
  },
  {
    id: 'kimi',
    name: 'Kimi（月之暗面）',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.6'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    note: 'kimi-k3 需账户充值至少 10 元解锁',
  },
  {
    id: 'doubao',
    name: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-2-1-turbo-260628', 'doubao-seed-2-1-pro-260628', 'doubao-seed-2-0-lite-260428'],
    keyUrl: 'https://console.volcengine.com/ark/region:cn-beijing/apiKey',
    note: '模型名需带日期后缀，也可填接入点 ep-xxx；turbo 便宜够用',
  },
  {
    id: 'custom',
    name: '自定义（OpenAI 兼容）',
    baseUrl: '',
    models: [],
    keyUrl: '',
    note: '任何 OpenAI 协议兼容端点，填 base URL 和模型名即可',
  },
]

export function getPreset(id: string): AiProviderPreset {
  return AI_PRESETS.find((p) => p.id === id) ?? AI_PRESETS[AI_PRESETS.length - 1]
}

export function defaultConfig(preset: AiProviderPreset): AiConfig {
  return {
    providerId: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.models[0] ?? '',
  }
}
