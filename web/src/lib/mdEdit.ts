// Toolbar edits for a Markdown textarea. Each takes the text and the selection and returns the new text and selection.
export type Edit = { value: string; start: number; end: number }

// Wraps the selection in a marker (** or *); a second press on wrapped text takes the marker off.
export function wrapSelection(value: string, start: number, end: number, mark: string): Edit {
  const n = mark.length
  const sel = value.slice(start, end)
  // Count the * run on each side: *text* is italic, **text** bold, ***text*** both, so italic on bold wraps again instead of stripping the bold.
  const k = Math.min(/\*+$/.exec(value.slice(0, start))?.[0].length ?? 0, /^\*+/.exec(value.slice(end))?.[0].length ?? 0)
  if (n === 1 ? k % 2 === 1 : k >= 2)
    return { value: value.slice(0, start - n) + sel + value.slice(end + n), start: start - n, end: end - n }
  return { value: value.slice(0, start) + mark + sel + mark + value.slice(end), start: start + n, end: end + n }
}

// Puts a prefix (## or -) on every selected line; when every line already has it, takes it off.
export function prefixLines(value: string, start: number, end: number, prefix: string): Edit {
  const from = start > 0 ? value.lastIndexOf('\n', start - 1) + 1 : 0
  // A selection that ends right after a line break (a triple-click) does not take in the next line.
  const nl = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  const to = nl < 0 ? value.length : nl
  const lines = value.slice(from, to).split('\n')
  const on = lines.every((l) => l.startsWith(prefix))
  const block = lines.map((l) => (on ? l.slice(prefix.length) : prefix + l)).join('\n')
  return { value: value.slice(0, from) + block + value.slice(to), start: from, end: from + block.length }
}
