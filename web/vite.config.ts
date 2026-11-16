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

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadAnuphan()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // Node 25 ships an experimental localStorage that shadows jsdom's; turn it off for test workers.
  test: {
    environment: 'jsdom',
    execArgv: Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-webstorage'] : [],
  },
})
