declare module 'markdown-it' {
  export default class MarkdownIt {
    constructor(options?: Record<string, unknown>)
    render(src: string): string
  }
}

declare module 'diff2html' {
  export function html(input: string, config?: Record<string, unknown>): string
}
