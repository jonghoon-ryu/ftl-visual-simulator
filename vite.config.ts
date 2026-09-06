import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this as a project site at
  // jonghoon-ryu.github.io/ftl-visual-simulator-app/, not at the domain
  // root, so every built asset URL needs this prefix. The repo is named
  // "-app" (not just "ftl-visual-simulator") specifically to avoid
  // colliding with the blog's own /ftl-visual-simulator/* documentation
  // pages, which live in the separate jonghoon-ryu.github.io repo and were
  // briefly shadowed by this app's Pages site before the rename.
  base: '/ftl-visual-simulator-app/',
  plugins: [react()],
})
