import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'main.js',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'chokidar'],
            },
          },
        },
      },
      {
        entry: 'preload.js',
        onstart(args) {
          args.reload()
        },
      },
    ]),
  ],
})
