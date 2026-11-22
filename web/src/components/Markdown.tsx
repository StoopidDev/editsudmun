import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'

// Images are dropped and raw HTML stays off, so a clip cannot load remote content in the reader's browser.
const components: Components = {
  h1: ({ children }) => <h3 className="text-[1.15em] font-bold text-ink">{children}</h3>,
  h2: ({ children }) => <h4 className="text-[1.05em] font-bold text-ink">{children}</h4>,
  h3: ({ children }) => <h4 className="text-[1.05em] font-bold text-ink">{children}</h4>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-line pl-3 text-sub">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="link-action">{children}</a>,
  code: ({ children }) => <code className="rounded bg-surface px-1 text-[0.9em]">{children}</code>,
  // A script pasted with indented lines parses as a code block; it must still wrap like the rest.
  pre: ({ children }) => <pre className="font-sans whitespace-pre-wrap">{children}</pre>,
  hr: () => <hr className="border-grid" />,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 wrap-anywhere ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]} disallowedElements={['img']} components={components}>{text}</ReactMarkdown>
    </div>
  )
}
