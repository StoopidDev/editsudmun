// A note is one point per line. Lines that are not already a list item, heading or quote (a #hashtag is not a heading) become bullets, so old plain notes still show as a list.
export function noteToMarkdown(note: string): string {
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/^(?:[-*+] |\d+[.)] |#{1,6}\s|>)/.test(line) ? line : `- ${line}`))
    .join('\n')
}

// Card previews and search snippets show plain text, so Markdown markers must not appear as ** or #.
export function plainPreview(text: string): string {
  return text
    .split('\n')
    .map((line) => line
      .replace(/^\s*#+\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|~~|`/g, '')
      .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/g, '$1$2')
      .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1$2'))
    .join('\n')
}
