import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the build path-independent, so it works on
// GitHub Pages project sites (https://user.github.io/repo/) without config.
export default defineConfig({
  base: './',
  plugins: [react()],
})
