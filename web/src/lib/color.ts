const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Owners pick any category colour, so text colour is computed, never assumed.
export const readableOn = (bg: string) =>
  contrast(bg, '#ffffff') >= contrast(bg, '#1e1e1e') ? '#ffffff' : '#1e1e1e'

const PALETTE = ['#6155f5', '#34c759', '#ff9500', '#ff2d55', '#00a3bf', '#8e5a2b', '#5f5f5f']

export const nextColor = (used: string[]) => {
  const taken = used.map((c) => c.toLowerCase())
  return PALETTE.find((c) => !taken.includes(c)) ?? PALETTE[0]
}
