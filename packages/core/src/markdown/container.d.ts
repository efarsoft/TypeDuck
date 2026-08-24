declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it'

  interface ContainerOptions {
    validate?: (params: string) => boolean
    render?: (tokens: unknown[], index: number) => string
  }

  const container: (md: MarkdownIt, name: string, options?: ContainerOptions) => void
  export default container
}
