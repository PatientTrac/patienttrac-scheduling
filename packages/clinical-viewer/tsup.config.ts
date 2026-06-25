import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@supabase/supabase-js',
    '@tanstack/react-query',
    'recharts',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
