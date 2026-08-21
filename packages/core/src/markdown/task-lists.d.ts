declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const taskLists: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean }) => void
  export default taskLists
}

declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean
    linkify?: boolean
    highlight?: (str: string, lang: string) => string
  }
}
