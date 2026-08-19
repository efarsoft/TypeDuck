import type { Theme } from './types'

import { theme as github } from './themes/github'
import { theme as medium } from './themes/medium'
import { theme as minimalWhite } from './themes/minimal-white'
import { theme as notion } from './themes/notion'
import { theme as smartisanNote } from './themes/smartisan-note'
import { theme as wechatGreen } from './themes/wechat-green'
import { theme as bauhaus } from './themes/bauhaus'
import { theme as classicBlue } from './themes/classic-blue'
import { theme as darkNight } from './themes/dark-night'
import { theme as linearDark } from './themes/linear-dark'
import { theme as minimalBlack } from './themes/minimal-black'
import { theme as warmOrange } from './themes/warm-orange'
import { theme as autumnGlow } from './themes/autumn-glow'
import { theme as claudeOat } from './themes/claude-oat'
import { theme as coffeeHouse } from './themes/coffee-house'
import { theme as inkWash } from './themes/ink-wash'
import { theme as letterPaper } from './themes/letter-paper'
import { theme as nytPaper } from './themes/nyt-paper'
import { theme as retroParchment } from './themes/retro-parchment'

/** 内置主题（按 日常写作 / 个性表达 / 文艺叙事 分组排列） */
export const themes: Theme[] = [
  // 日常写作
  github,
  medium,
  minimalWhite,
  notion,
  smartisanNote,
  wechatGreen,
  // 个性表达
  bauhaus,
  classicBlue,
  darkNight,
  linearDark,
  minimalBlack,
  warmOrange,
  // 文艺叙事
  autumnGlow,
  claudeOat,
  coffeeHouse,
  inkWash,
  letterPaper,
  nytPaper,
  retroParchment,
]

/** 运行时注册自定义主题（AI 生成主题的入口）：注册后即可通过 getTheme 使用 */
export function registerTheme(theme: Theme): void {
  if (!themes.some((t) => t.id === theme.id)) {
    themes.push(theme)
  }
}

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0]
}
