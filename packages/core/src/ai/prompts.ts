import type { AiMessage } from './types'

/** AI 写作动作：id 与编辑器工具栏 / AI 面板功能卡一一对应 */
export type AiActionId =
  | 'polish'
  | 'expand'
  | 'shorten'
  | 'continue'
  | 'titles'
  | 'custom'
  | 'outline'
  | 'digest'
  | 'theme'

export const AI_ACTIONS: Record<AiActionId, { label: string; needsSelection: boolean }> = {
  polish: { label: 'AI 润色', needsSelection: true },
  expand: { label: 'AI 扩写', needsSelection: true },
  shorten: { label: 'AI 缩写', needsSelection: true },
  continue: { label: 'AI 续写', needsSelection: false },
  titles: { label: '生成标题', needsSelection: false },
  custom: { label: '自定义指令', needsSelection: true },
  outline: { label: '生成大纲', needsSelection: false },
  digest: { label: '生成摘要', needsSelection: false },
  theme: { label: '生成主题', needsSelection: false },
}

const BASE_STYLE =
  '你是一位资深微信公众号写作助手。输出使用简体中文，保留 Markdown 格式（标题、列表、加粗、代码块等原样保留）。'

export interface ActionInput {
  /** 选中的文字（润色/扩写/缩写/自定义指令） */
  selection?: string
  /** 光标前全文（续写上文、摘要的正文来源） */
  before?: string
  /** 文档标题（标题/摘要生成时作为参考） */
  title?: string
  /** 自定义指令内容 */
  instruction?: string
  /** 大纲主题 */
  topic?: string
  /** 大纲风格 */
  style?: string
  /** AI 主题的风格描述 */
  description?: string
  /** AI 主题的布局模板 */
  template?: string
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
    case 'custom':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是严格按照用户给出的指令处理文字。指令与文字内容冲突时以指令为准，只输出处理结果，不要任何解释。`,
        },
        { role: 'user', content: `指令：${input.instruction ?? ''}\n\n文字：\n\n${selection}` },
      ]
    case 'outline':
      return [
        {
          role: 'system',
          content:
            '你是一位公众号文章结构设计师。根据主题产出一份 Markdown 大纲：以「# 标题」开头（给文章起一个可直接使用的标题），下设 4～6 个「## 二级标题」章节，每个章节下用一行「> 要点：……」说明这节要写什么（结构复杂时可加「### 三级标题」）。只输出 Markdown 大纲本身，不要解释。',
        },
        {
          role: 'user',
          content: `主题：${input.topic ?? ''}\n文章风格：${input.style || '通用'}\n\n请输出文章大纲。`,
        },
      ]
    case 'digest':
      return [
        {
          role: 'system',
          content:
            '你是公众号摘要写手。基于文章内容写一条不超过 120 字的摘要：概括核心信息，语气与正文一致，不要用「本文介绍了」这类套话开头，不加引号、不加解释、不换行，直接输出摘要文本。',
        },
        {
          role: 'user',
          content: `${input.title ? `文档标题：${input.title}\n\n` : ''}正文：\n\n${(input.before ?? '').slice(0, 6000)}`,
        },
      ]
    case 'theme':
      return [
        {
          role: 'system',
          content: buildThemeTokenPrompt(),
        },
        {
          role: 'user',
          content: `风格描述：${input.description ?? ''}\n\n请输出主题设计令牌 JSON。`,
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

/** 「生成主题」的 system prompt：令牌 schema 写死在提示词里，模型只允许填空 */
function buildThemeTokenPrompt(): string {
  return [
    '你是公众号排版主题设计师。根据用户的风格描述，产出一份主题设计令牌 JSON。',
    '严格遵守以下模式——字段名和枚举值一字不差，全部字段必须给出，只输出 JSON 本体，不要 markdown 代码块，不要任何解释：',
    '{',
    '  "name": "主题名，2-6 个字",',
    '  "description": "一句话定位，10-20 字",',
    '  "primary": "#RRGGBB 主强调色，用于标题/链接/引用点缀",',
    '  "headingColor": "#RRGGBB 标题文字色",',
    '  "textColor": "#RRGGBB 正文文字色，要足够深保证可读",',
    '  "backgroundTone": "white | warm | gray | tint",',
    '  "headingFont": "sans | serif",',
    '  "headingStyle": "plain | left-bar | underline | block",',
    '  "quoteStyle": "left-border | background | italic",',
    '  "linkStyle": "color | underline",',
    '  "codeStyle": "light | dark",',
    '  "radius": "none | small | large",',
    '  "density": "compact | normal | airy"',
    '}',
    '设计要求：主强调色鲜明但不刺眼；正文色与背景对比度足够；深色背景时正文色必须用浅色；整体协调、适合微信公众号长文阅读。',
  ].join('\n')
}
