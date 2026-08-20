/** 元素样式表：值为内联 CSS 声明字符串 */
export interface ThemeStyles {
  root: string
  h1: string
  h2: string
  h3: string
  h4: string
  h5: string
  h6: string
  p: string
  a: string
  strong: string
  em: string
  del: string
  ul: string
  ol: string
  li: string
  blockquote: string
  code: string
  codeBlock: string
  codeBlockWrapper: string
  table: string
  thead: string
  th: string
  td: string
  tr: string
  img: string
  hr: string
  [key: string]: string
}

/**
 * 主题分组按使用场景划分（而非视觉风格）——用户选主题时想的是"我写什么文章"。
 * daily 日常写作 / expressive 个性撞色 / narrative 文艺叙事 / dark 深色沉浸 / ai 运行时注册（AI 生成）。
 */
export type ThemeCategory = 'daily' | 'expressive' | 'narrative' | 'dark' | 'ai'

export interface Theme {
  id: string
  name: string
  /** 一句话定位：适合什么文章，显示在主题卡片上 */
  description: string
  category: ThemeCategory
  /** 预览面板背景，用于预览区外层容器 */
  previewBackground: string
  styles: ThemeStyles
  /** highlight.js token class -> 内联样式映射 */
  hljsStyleMap: Record<string, string>
  /**
   * 进阶自定义 CSS（可选）：仅作用于「网页预览 / 导出 HTML / 导出 PDF」路径，
   * 会由渲染层自动加 `.td-rich` 作用域前缀后注入 <style>。
   * 用于 drop-cap、首字下沉、阴影、渐变、动画等微信/Word 不支持的效果；
   * 公众号复制与 Word 导出仍走 `styles` 安全内联，customCss 不会注入。
   */
  customCss?: string
}
