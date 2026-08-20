import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import { defaultConfig, getPreset, type AiActionId, type ActionInput, type AiConfig, type Theme } from '@typeduck/core'

const STORAGE_KEY = 'typeduck:ai'

/** 一次 AI 任务的状态（面板展示与结果回写编辑器都用它） */
export interface AiTask {
  docId: string
  action: AiActionId
  status: 'streaming' | 'done' | 'error'
  /** 流式累计的结果文本；出错时为错误信息 */
  text: string
  input: ActionInput
  /** 选区范围（替换用）；续写/标题为 null */
  range: { from: number; to: number } | null
  /** 生成主题动作编译出的 Theme 预览 */
  theme?: Theme
}

function loadConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultConfig(getPreset('deepseek')), ...(JSON.parse(raw) as Partial<AiConfig>) }
  } catch {
    /* 损坏的存储当首次使用处理 */
  }
  return defaultConfig(getPreset('deepseek'))
}

export const useAiStore = defineStore('ai', () => {
  const config = reactive<AiConfig>(loadConfig())
  const isConfigured = computed(() => !!config.baseUrl && !!config.apiKey && !!config.model)

  watch(
    config,
    (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
    { deep: true },
  )

  /** 切换供应商预设：自动填 Base URL 与默认模型（Key 保留用户已填内容） */
  function applyPreset(id: string) {
    const preset = getPreset(id)
    config.providerId = preset.id
    config.baseUrl = preset.baseUrl
    config.model = preset.models[0] ?? ''
  }

  return { config, isConfigured, applyPreset }
})
