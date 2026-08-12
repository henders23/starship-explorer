import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts'],
    // The worldgen property test generates hundreds of galaxies; the default
    // five-second timeout is not a meaningful signal for it.
    testTimeout: 600_000,
  },
})
