/**
 * `:::module` 容器语法：提示框 / 警告 / 金句卡 / 关注引导等模块。
 * 每个模块在 ThemeStyles 里对应一个键（如 moduleTip），主题可自定义样式。
 * 未定义的主题自动回退到内置默认样式（跟随主题主色）。
 */
import type { Theme } from '../theme/types'

export type ModuleId = 'tip' | 'warning' | 'quote' | 'follow' | 'divider'

export const MODULES: { id: ModuleId; title: string; desc: string; example: string }[] = [
  { id: 'tip', title: '提示框', desc: '绿色/主题色提示', example: '::: tip\n这里是提示内容\n:::' },
  { id: 'warning', title: '警告框', desc: '醒目警示', example: '::: warning\n注意这里\n:::' },
  { id: 'quote', title: '金句卡', desc: '居中强调', example: '::: quote\n一句金句\n:::' },
  { id: 'follow', title: '关注引导', desc: '文末求关注', example: '::: follow\n觉得有用？关注我\n:::' },
  { id: 'divider', title: '花式分割线', desc: '❖ 分割', example: '::: divider\n:::' },
]

/** 从主题样式表提取签名色（模块默认样式的颜色来源） */
function themeAccent(theme: Theme): string {
  const h2 = theme.styles.h2 || ''
  const link = theme.styles.a || ''
  const m = h2.match(/color:\s*(#[0-9a-fA-F]{3,8})/) || link.match(/color:\s*(#[0-9a-fA-F]{3,8})/)
  return m ? m[1] : '#07c160'
}

function themeText(theme: Theme): string {
  const m = (theme.styles.root || '').match(/color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/)
  return m ? m[1] : '#333'
}

function themeBg(theme: Theme): string {
  return theme.previewBackground || '#fff'
}

/** 模块默认样式（主题未定义 moduleXxx 时回退使用） */
export function moduleDefaultStyle(id: ModuleId, theme: Theme): string {
  const accent = themeAccent(theme)
  const text = themeText(theme)
  switch (id) {
    case 'tip':
      return `margin:1.4em 0;padding:14px 18px;border-left:4px solid ${accent};background:rgba(0,0,0,0.03);border-radius:0 8px 8px 0;color:${text};`
    case 'warning':
      return `margin:1.4em 0;padding:14px 18px;border-left:4px solid #e6a23c;background:#fdf6ec;border-radius:0 8px 8px 0;color:#8a6116;`
    case 'quote':
      return `margin:1.6em 0;padding:18px 24px;text-align:center;font-size:1.1em;font-weight:600;color:${accent};border-top:1px solid ${accent}55;border-bottom:1px solid ${accent}55;`
    case 'follow':
      return `margin:1.8em 0;padding:16px 20px;text-align:center;background:${accent};color:#fff;border-radius:10px;font-weight:600;`
    case 'divider':
      return `margin:2em 0;text-align:center;color:${accent};letter-spacing:12px;font-size:18px;`
  }
}
