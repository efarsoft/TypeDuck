declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean
    linkify?: boolean
    highlight?: (str: string, lang: string) => string
  }
}
