import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this as a project site at
  // jonghoon-ryu.github.io/ftl-visual-simulator/, not at the domain root,
  // so every built asset URL needs this prefix.
  base: '/ftl-visual-simulator/',
  plugins: [react()],
})
