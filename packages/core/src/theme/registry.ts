import type { Theme } from './types'

// 日常写作（干净通用，浅底无衬线）
import { theme as minimalWhite } from './themes/minimal-white'
import { theme as wechatGreen } from './themes/wechat-green'
import { theme as github } from './themes/github'
import { theme as medium } from './themes/medium'
import { theme as smartisanNote } from './themes/smartisan-note'
import { theme as highlight } from './themes/highlight'
import { theme as cardFlow } from './themes/card-flow'
import { theme as financeBlue } from './themes/finance-blue'
// 个性撞色（强对比彩色，视觉冲击）
import { theme as classicBlue } from './themes/classic-blue'
import { theme as bauhaus } from './themes/bauhaus'
import { theme as warmOrange } from './themes/warm-orange'
import { theme as autumnGlow } from './themes/autumn-glow'
import { theme as cyanPastel } from './themes/cyan-pastel'
import { theme as rosePurple } from './themes/rose-purple'
import { theme as xiaohongshu } from './themes/xiaohongshu'
import { theme as ecomRed } from './themes/ecom-red'
import { theme as handlog } from './themes/handlog'
import { theme as holographic } from './themes/holographic'
import { theme as memphis } from './themes/memphis'
// 文艺叙事（衬线阅读，书卷气）
import { theme as claudeOat } from './themes/claude-oat'
import { theme as nytPaper } from './themes/nyt-paper'
import { theme as retroParchment } from './themes/retro-parchment'
import { theme as inkWash } from './themes/ink-wash'
import { theme as neoChinese } from './themes/neo-chinese'
import { theme as morandi } from './themes/morandi'
import { theme as forbiddenCity } from './themes/forbidden-city'
import { theme as magazine } from './themes/magazine'
// 深色沉浸（夜间 / 极客）
import { theme as darkNight } from './themes/dark-night'
import { theme as linearDark } from './themes/linear-dark'
import { theme as minimalBlack } from './themes/minimal-black'
import { theme as terminal } from './themes/terminal'
import { theme as cyberNeon } from './themes/cyber-neon'

/** 内置主题（按 日常写作 / 个性撞色 / 文艺叙事 / 深色沉浸 分组排列，组内顺序即展示顺序） */
export const themes: Theme[] = [
  // 日常写作
  minimalWhite,
  wechatGreen,
  github,
  medium,
  smartisanNote,
  highlight,
  cardFlow,
  financeBlue,
  // 个性撞色
  classicBlue,
  bauhaus,
  warmOrange,
  autumnGlow,
  cyanPastel,
  rosePurple,
  xiaohongshu,
  ecomRed,
  handlog,
  holographic,
  memphis,
  // 文艺叙事
  claudeOat,
  nytPaper,
  retroParchment,
  inkWash,
  neoChinese,
  morandi,
  forbiddenCity,
  magazine,
  // 深色沉浸
  darkNight,
  linearDark,
  minimalBlack,
  terminal,
  cyberNeon,
]

/** 运行时注册自定义主题（AI 生成主题的入口）：注册后即可通过 getTheme 使用 */
export function registerTheme(theme: Theme): void {
  if (!themes.some((t) => t.id === theme.id)) {
    themes.push(theme)
  }
}

/** 注销运行时注册的主题（仅 AI 生成主题会用到；内置主题不受影响） */
export function unregisterTheme(id: string): void {
  const idx = themes.findIndex((t) => t.id === id)
  if (idx > 0) themes.splice(idx, 1)
}

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0]
}
