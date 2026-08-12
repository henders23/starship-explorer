import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The worldgen property test generates hundreds of galaxies; the default
    // five-second timeout is not a meaningful signal for it.
    testTimeout: 600_000,
  },
})
