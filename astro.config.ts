import { defineConfig } from 'astro/config'
import { coverage } from './scripts/coverage'

// Coverage builds (npm run build:coverage) are instrumented, and may go to another folder.
const coverageBuild = Boolean(process.env.KUBESTACKS_COVERAGE)

export default defineConfig({
  // The public address, for canonical and social-preview links.
  site: 'https://kubestacks.com',
  outDir: process.env.KUBESTACKS_OUT_DIR || 'dist',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  integrations: coverageBuild ? [coverage()] : [],
})
