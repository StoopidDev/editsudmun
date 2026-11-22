/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

// Preload the Anuphan Thai and Latin woff2 (hashed by Vite) so the browser starts them from the HTML, not after the CSS is parsed.
const preloadAnuphan = (): Plugin => ({
  name: 'preload-anuphan',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_html, { bundle }) =>
      Object.keys(bundle ?? {})
        .filter((file) => /anuphan-(thai|latin)-wght-normal/.test(file))
        .map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${file}` },
          injectTo: 'head',
        })),
  },
})

// The shell, Home and the loaders are lazy chunks that the router only requests after the entry script has run, so
// they (and their shared imports) queued behind it, a ~2 s wait on Slow 4G. Preloading the whole static graph from the
// HTML downloads them alongside the entry. Vite already preloads the entry's own imports.
const preloadFirstRoute = (): Plugin => ({
  name: 'preload-first-route',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_html, { bundle = {} }) => {
      const seen = new Set<string>()
      const walk = (file: string) => {
        const chunk = bundle[file]
        if (seen.has(file) || chunk?.type !== 'chunk') return
        seen.add(file)
        chunk.imports.forEach(walk)
      }
      const entry = Object.keys(bundle).find((f) => bundle[f].type === 'chunk' && (bundle[f] as { isEntry: boolean }).isEntry)
      if (entry) walk(entry)
      const early = new Set(seen)
      seen.clear()
      Object.keys(bundle).filter((f) => /^assets\/(AppShell|Home|loaders)-.*\.js$/.test(f)).forEach(walk)
      return [...seen].filter((f) => !early.has(f))
        .map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${f}` }, injectTo: 'head' as const }))
    },
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadAnuphan(), preloadFirstRoute()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // Node 25 ships an experimental localStorage that shadows jsdom's; turn it off for test workers.
  test: {
    environment: 'jsdom',
    execArgv: Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-webstorage'] : [],
  },
})
