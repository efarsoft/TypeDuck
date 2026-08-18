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

export type ThemeCategory = 'minimal' | 'tech' | 'literary' | 'design'

export interface Theme {
  id: string
  name: string
  category: ThemeCategory
  /** 预览面板背景，用于预览区外层容器 */
  previewBackground: string
  styles: ThemeStyles
  /** highlight.js token class -> 内联样式映射 */
  hljsStyleMap: Record<string, string>
}
