import type { AiMessage } from './types'

/** AI 写作动作：id 与编辑器工具栏一一对应 */
export type AiActionId = 'polish' | 'expand' | 'shorten' | 'continue' | 'titles'

export const AI_ACTIONS: Record<AiActionId, { label: string; needsSelection: boolean }> = {
  polish: { label: '润色', needsSelection: true },
  expand: { label: '扩写', needsSelection: true },
  shorten: { label: '缩写', needsSelection: true },
  continue: { label: '续写', needsSelection: false },
  titles: { label: '生成标题', needsSelection: false },
}

const BASE_STYLE =
  '你是一位资深微信公众号写作助手。输出使用简体中文，保留 Markdown 格式（标题、列表、加粗、代码块等原样保留）。'

export interface ActionInput {
  /** 选中的文字（润色/扩写/缩写） */
  selection?: string
  /** 光标前全文（续写上文、标题生成的正文来源） */
  before?: string
  /** 文档标题（标题生成时作为参考） */
  title?: string
}

/** 分层 Prompt：每个动作一组消息，system 定风格、user 给素材 */
export function buildMessages(action: AiActionId, input: ActionInput): AiMessage[] {
  const selection = (input.selection ?? '').trim()
  const context = (input.before ?? '').slice(-4000)

  switch (action) {
    case 'polish':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是润色：让文字更流畅、更有公众号读者的阅读快感，修正口语赘述和语病，但严格保留原意、原有结构与信息量，不增删观点。只输出润色后的文字，不要任何解释。`,
        },
        { role: 'user', content: `请润色以下内容：\n\n${selection}` },
      ]
    case 'expand':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是扩写：在保留原文全部观点的基础上，补充细节、例子或论证，篇幅约为原文的 1.5～2 倍，语气与原文一致。只输出扩写后的文字，不要任何解释。`,
        },
        { role: 'user', content: `请扩写以下内容：\n\n${selection}` },
      ]
    case 'shorten':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是缩写：压缩到原文的一半左右，砍掉冗余但保留全部核心观点和关键数据，结构与原文对应。只输出缩写后的文字，不要任何解释。`,
        },
        { role: 'user', content: `请缩写以下内容：\n\n${selection}` },
      ]
    case 'continue':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是续写：顺着上文自然往下写 200～400 字，风格、人称、口吻与上文保持一致，不要重复上文内容，不要写结尾总结。只输出续写的新内容。`,
        },
        { role: 'user', content: `文章上文如下，请接着往下写：\n\n${context || '（上文为空，请围绕文档主题写一段开头。）'}` },
      ]
    case 'titles':
      return [
        {
          role: 'system',
          content:
            '你是一位起标题高手，深谙公众号爆款标题套路。根据文章内容生成 5 个候选标题，覆盖不同风格：干货型、悬念型、数字型、情绪型、反差型各一个。要求：每个不超过 30 字、不夸大事实、不使用感叹号堆砌。输出格式：每行一个标题，不要编号，不要序号，不要任何解释。',
        },
        {
          role: 'user',
          content: `${input.title ? `文档现标题：${input.title}\n\n` : ''}文章内容如下：\n\n${(input.before ?? '').slice(0, 4000)}`,
        },
      ]
  }
}

/** 解析「生成标题」输出：按行拆分，去掉可能的编号前缀与空行，最多取 5 条 */
export function parseTitles(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^[-*·•>\d.、()\s]+/, '').replace(/["“”']/g, ''))
    .filter((line) => line.length >= 4 && line.length <= 40)
    .slice(0, 5)
}
