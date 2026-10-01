import { defineConfig } from 'astro/config'

export default defineConfig({
  // The public address, for canonical and social-preview links.
  site: 'https://kubestacks.com',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
})
