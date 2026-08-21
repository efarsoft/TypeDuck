import type { Theme, ThemeStyles } from './types'
import { hljsLight, hljsDark } from './hljs-maps'

/**
 * AI 生成主题：模型只产出「设计令牌」（受控字段的 JSON），由本地的布局模板编译成完整 Theme。
 * 「布局 DNA × 色彩皮肤」——模板保证结构合法，令牌决定观感，模型一个 CSS 字符都碰不到。
 */

export interface AiThemeTokens {
  name: string
  description: string
  primary: string
  headingColor: string
  textColor: string
  backgroundTone: 'white' | 'warm' | 'gray' | 'tint'
  headingFont: 'sans' | 'serif'
  headingStyle: 'plain' | 'left-bar' | 'underline' | 'block'
  quoteStyle: 'left-border' | 'background' | 'italic'
  linkStyle: 'color' | 'underline'
  codeStyle: 'light' | 'dark'
  radius: 'none' | 'small' | 'large'
  density: 'compact' | 'normal' | 'airy'
}

export type AiThemeTemplate = 'clean' | 'card' | 'literary'

const DEFAULT_TOKENS: AiThemeTokens = {
  name: 'AI 主题',
  description: 'AI 生成的自定义主题',
  primary: '#07c160',
  headingColor: '#1a1a1a',
  textColor: '#2f2f2f',
  backgroundTone: 'white',
  headingFont: 'sans',
  headingStyle: 'plain',
  quoteStyle: 'left-border',
  linkStyle: 'color',
  codeStyle: 'light',
  radius: 'small',
  density: 'normal',
}

const HEX = /^#[0-9a-fA-F]{6}$/

const ENUM_VALUES = {
  backgroundTone: ['white', 'warm', 'gray', 'tint'],
  headingFont: ['sans', 'serif'],
  headingStyle: ['plain', 'left-bar', 'underline', 'block'],
  quoteStyle: ['left-border', 'background', 'italic'],
  linkStyle: ['color', 'underline'],
  codeStyle: ['light', 'dark'],
  radius: ['none', 'small', 'large'],
  density: ['compact', 'normal', 'airy'],
} as const

/** 从模型回复中提取第一个 JSON 对象，字段级消毒：非法丢弃、缺省补默认值 */
export function extractAiTokens(text: string): AiThemeTokens | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }

  const t: AiThemeTokens = { ...DEFAULT_TOKENS }
  if (typeof raw.name === 'string' && raw.name.trim()) t.name = raw.name.trim().slice(0, 12)
  if (typeof raw.description === 'string' && raw.description.trim())
    t.description = raw.description.trim().slice(0, 30)
  for (const key of ['primary', 'headingColor', 'textColor'] as const) {
    const v = raw[key]
    if (typeof v === 'string' && HEX.test(v.trim())) t[key] = v.trim()
  }
  for (const [key, values] of Object.entries(ENUM_VALUES)) {
    const v = raw[key]
    if (typeof v === 'string' && (values as readonly string[]).includes(v.trim()))
      (t as unknown as Record<string, string>)[key] = v.trim()
  }
  return t
}

/* ---------- 令牌 → 样式的编译辅助 ---------- */

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** 颜色混合：将 color 与白色按 ratio（0-1）混合，产出柔和的底色 */
function mixWhite(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex)
  const mix = (c: number) => Math.round(c + (255 - c) * ratio)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function isDarkColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

const FONT_SANS =
  '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
const FONT_SERIF = '"PingFang SC","Songti SC","Noto Serif SC",Georgia,serif'
const FONT_MONO = '"SFMono-Regular",Consolas,Menlo,monospace'

/** 三套布局模板：简洁（极简白 DNA）/ 卡片强调（卡片流 DNA）/ 文艺留白（燕麦稿 DNA） */
function buildStyles(t: AiThemeTokens, tpl: AiThemeTemplate): ThemeStyles {
  const pageBg =
    t.backgroundTone === 'warm'
      ? '#faf6f0'
      : t.backgroundTone === 'gray'
        ? '#f5f6f7'
        : t.backgroundTone === 'tint'
          ? mixWhite(t.primary, 0.94)
          : '#ffffff'
  const darkPage = isDarkColor(pageBg)
  const radius = t.radius === 'none' ? '0' : t.radius === 'large' ? '14px' : '6px'
  const lineH = t.density === 'compact' ? 1.7 : t.density === 'airy' ? 1.95 : 1.8
  const gap = t.density === 'compact' ? '0.8em' : t.density === 'airy' ? '1.25em' : '1em'
  const hFont = t.headingFont === 'serif' || tpl === 'literary' ? FONT_SERIF : FONT_SANS
  const border = darkPage ? 'rgba(255,255,255,0.16)' : rgba(t.textColor, 0.14)
  const softBg = darkPage ? 'rgba(255,255,255,0.06)' : rgba(t.textColor, 0.05)
  const muted = darkPage ? 'rgba(255,255,255,0.62)' : rgba(t.textColor, 0.6)
  // 深色底自动反转正文/标题色，保证可读（模型偶尔会给出深底深字）
  const textColor = darkPage && isDarkColor(t.textColor) ? '#e8e8e8' : t.textColor
  const headingColor = darkPage && isDarkColor(t.headingColor) ? '#f2f2f2' : t.headingColor

  const headingMargin = tpl === 'literary' ? '1.9em 0 0.9em' : '1.6em 0 0.8em'

  let h2: string
  if (tpl === 'card') {
    h2 = `margin:${headingMargin};font-size:1.28em;font-weight:700;color:${headingColor};font-family:${hFont};background:${darkPage ? 'rgba(255,255,255,0.08)' : mixWhite(t.primary, 0.9)};padding:0.5em 0.8em;border-radius:${radius};`
  } else if (t.headingStyle === 'block') {
    h2 = `margin:${headingMargin};font-size:1.26em;font-weight:700;color:${isDarkColor(t.primary) ? '#ffffff' : '#fff'};font-family:${hFont};background:${t.primary};padding:0.35em 0.75em;border-radius:${radius};`
  } else if (t.headingStyle === 'left-bar') {
    h2 = `margin:${headingMargin};font-size:1.3em;font-weight:700;color:${headingColor};font-family:${hFont};border-left:4px solid ${t.primary};padding-left:12px;`
  } else if (t.headingStyle === 'underline') {
    h2 = `margin:${headingMargin};font-size:1.3em;font-weight:700;color:${headingColor};font-family:${hFont};border-bottom:2px solid ${t.primary};padding-bottom:0.3em;`
  } else {
    h2 = `margin:${headingMargin};font-size:1.3em;font-weight:700;color:${headingColor};font-family:${hFont};`
  }

  let blockquote: string
  if (tpl === 'card') {
    blockquote = `margin:1.4em 0;padding:0.9em 1.2em;border-left:none;background:${darkPage ? 'rgba(255,255,255,0.07)' : mixWhite(t.primary, 0.92)};border-radius:${radius};color:${muted};`
  } else if (t.quoteStyle === 'background') {
    blockquote = `margin:1.4em 0;padding:0.85em 1.1em;background:${softBg};border-radius:${radius};color:${muted};`
  } else if (t.quoteStyle === 'italic') {
    blockquote = `margin:1.4em 0;padding:0.4em 1em;border-left:2px solid ${rgba(t.primary, 0.5)};color:${muted};font-style:italic;`
  } else {
    blockquote = `margin:1.4em 0;padding:0.85em 1.1em;border-left:4px solid ${t.primary};background:${softBg};color:${muted};`
  }

  const a =
    t.linkStyle === 'underline'
      ? `color:${t.primary};text-decoration:underline;text-underline-offset:3px;`
      : `color:${t.primary};text-decoration:none;border-bottom:1px solid ${rgba(t.primary, 0.35)};`

  const codeDark = t.codeStyle === 'dark'
  const codeBlockWrapper = codeDark
    ? `background:#1e1e1e;padding:16px;border-radius:${t.radius === 'large' ? '14px' : '8px'};overflow-x:auto;margin:1.4em 0;`
    : `background:${darkPage ? 'rgba(255,255,255,0.07)' : mixWhite(t.primary, 0.95)};padding:16px;border-radius:${t.radius === 'large' ? '14px' : '8px'};overflow-x:auto;margin:1.4em 0;`

  return {
    root: `color:${textColor};font-size:15px;line-height:${lineH};letter-spacing:0.3px;word-break:break-word;font-family:${tpl === 'literary' ? FONT_SERIF : FONT_SANS};`,
    h1: `margin:${headingMargin};font-size:1.6em;font-weight:700;color:${headingColor};font-family:${hFont};text-align:${tpl === 'literary' ? 'center' : 'left'};`,
    h2,
    h3: `margin:1.4em 0 0.6em;font-size:1.15em;font-weight:600;color:${headingColor};font-family:${hFont};`,
    h4: `margin:1.3em 0 0.5em;font-size:1.05em;font-weight:600;color:${headingColor};font-family:${hFont};`,
    h5: `margin:1.2em 0 0.4em;font-size:1em;font-weight:600;color:${textColor};`,
    h6: `margin:1.1em 0 0.4em;font-size:0.92em;font-weight:600;color:${muted};`,
    p: `margin:${gap} 0;`,
    a,
    strong: `font-weight:700;color:${headingColor};`,
    em: 'font-style:italic;',
    del: `text-decoration:line-through;color:${muted};`,
    ul: `margin:${gap} 0;padding-left:1.6em;`,
    ol: `margin:${gap} 0;padding-left:1.6em;`,
    li: 'margin:0.4em 0;',
    blockquote,
    code: `background:${codeDark ? 'rgba(255,255,255,0.12)' : softBg};color:${t.primary};padding:2px 6px;border-radius:4px;font-size:0.88em;font-family:${FONT_MONO};`,
    codeBlock: `font-family:${FONT_MONO};font-size:13px;line-height:1.7;color:${codeDark ? '#d4d4d4' : textColor};`,
    codeBlockWrapper,
    table: `border-collapse:collapse;margin:1.4em 0;width:100%;font-size:0.95em;`,
    thead: '',
    th: `border:1px solid ${border};background:${darkPage ? 'rgba(255,255,255,0.08)' : mixWhite(t.primary, 0.9)};padding:9px 13px;font-weight:600;color:${headingColor};`,
    td: `border:1px solid ${border};padding:9px 13px;`,
    tr: '',
    img: `max-width:100%;border-radius:${radius === '0' ? '0' : radius};display:block;margin:1.4em auto;`,
    hr: `border:none;border-top:1px solid ${border};margin:2.2em 0;`,
  }
}

/** 令牌 + 模板 → 可注册的 Theme 对象 */
export function compileAiTheme(tokens: AiThemeTokens, template: AiThemeTemplate = 'clean'): Theme {
  const tpl: AiThemeTemplate =
    template === 'card' || template === 'literary' ? template : 'clean'
  return {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: tokens.name,
    description: tokens.description,
    category: 'ai',
    previewBackground:
      tokens.backgroundTone === 'warm'
        ? '#faf6f0'
        : tokens.backgroundTone === 'gray'
          ? '#f5f6f7'
          : tokens.backgroundTone === 'tint'
            ? mixWhite(tokens.primary, 0.94)
            : '#ffffff',
    styles: buildStyles(tokens, tpl),
    hljsStyleMap: tokens.codeStyle === 'dark' ? hljsDark : hljsLight,
  }
}

/* ---------- localStorage 持久化（与文档、AI Key 同一套本地优先机制） ---------- */

const STORAGE_KEY = 'typeduck:aiThemes'
const AI_THEME_LIMIT = 20

export function loadSavedAiThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Theme[]
    return Array.isArray(list) ? list.filter((t) => t && t.id && t.styles) : []
  } catch {
    return []
  }
}

export function persistAiTheme(theme: Theme): void {
  const list = loadSavedAiThemes().filter((t) => t.id !== theme.id)
  list.unshift(theme)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, AI_THEME_LIMIT)))
}

export function removeSavedAiTheme(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadSavedAiThemes().filter((t) => t.id !== id)))
}
