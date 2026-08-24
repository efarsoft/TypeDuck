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
  | 'rewrite'
  | 'write'

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
  rewrite: { label: 'AI 改写', needsSelection: false },
  write: { label: 'AI 写文章', needsSelection: false },
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
  /** 大纲/写作风格 */
  style?: string
  /** AI 主题的风格描述 */
  description?: string
  /** AI 主题的布局模板 */
  template?: string
  /** AI 写文章的目标读者 */
  audience?: string
  /** AI 写文章的期望字数 */
  wordCount?: string
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
    case 'rewrite':
      return [
        {
          role: 'system',
          content: `${BASE_STYLE}你的任务是编辑部改写：基于提供的原文，产出一篇全新的公众号文章。要求：保留原文的全部核心事实与关键信息，不添加原文没有的事实；用自己的结构重新组织（不要逐句对照翻译式改写）；先输出一个 "## " 开头的 H2 标题；若用户给了风格指令则优先遵循。只输出改写后的文章。`,
        },
        {
          role: 'user',
          content: `${input.instruction ? `风格要求：${input.instruction}\n\n` : ''}${input.title ? `原文标题：${input.title}\n\n` : ''}原文：\n\n${(input.selection ?? '').slice(0, 12000)}`,
        },
      ]
    case 'write':
      return [
        {
          role: 'system',
          content: buildWritePrompt(input.style),
        },
        {
          role: 'user',
          content: `主题：${input.topic ?? ''}\n${input.audience ? `目标读者：${input.audience}\n` : ''}字数：${input.wordCount || '1500'} 字左右\n\n请写一篇完整的公众号文章。`,
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

/** 「AI 写文章」的写作风格模板——每种风格对应一种文章结构 */
export const WRITE_STYLES = [
  { id: 'general', name: '通用' },
  { id: 'tutorial', name: '技术教程' },
  { id: 'review', name: '产品测评' },
  { id: 'opinion', name: '观点评论' },
  { id: 'recommend', name: '好物推荐' },
] as const

function buildWritePrompt(style?: string): string {
  const base = `${BASE_STYLE}你是一位资深公众号写手，根据给定主题写一篇完整的文章。要求：有吸引人的标题（## 开头）、有小标题分节、语言口语化、观点鲜明、结尾有总结或金句。直接输出 Markdown，不要解释。`

  switch (style) {
    case 'tutorial':
      return `${base}
文章结构要求（技术教程风格）：
1. 问题引入——用一个具体场景让读者产生共鸣
2. 方案概述——你要教什么，学完能干什么
3. 分步实现——每个步骤一个 H3 小节，附代码或操作截图描述
4. 踩坑提醒——常见的坑和解决方法
5. 总结——核心要点 + 延伸阅读建议`
    case 'review':
      return `${base}
文章结构要求（产品测评风格）：
1. 吸引开头——一句话说清产品最核心的价值
2. 产品概览——它是什么、解决什么问题、和竞品的关键差异
3. 优点——用具体场景说明，不要空洞夸
4. 缺点——诚实指出不足，增加可信度
5. 使用体验——真实感受，有细节
6. 值不值得——明确结论，适合谁不适合谁`
    case 'opinion':
      return `${base}
文章结构要求（观点评论风格）：
1. 事件背景——最近发生了什么，为什么值得关注
2. 核心观点——一句话说清你的立场
3. 论据一——数据或案例支撑
4. 论据二——逻辑推理
5. 论据三——补充视角
6. 反方观点——承认对立面的合理性，然后反驳或包容
7. 结论——重申观点，留下思考`
    case 'recommend':
      return `${base}
文章结构要求（好物推荐风格）：
1. 痛点引入——没有这个东西之前多麻烦
2. 为什么选它——对比同类，突出核心优势
3. 怎么用——具体使用场景和技巧
4. 购买建议——哪里买、多少钱、什么时候买划算
5. 总结——一句话推荐理由`
    default:
      return base
  }
}
