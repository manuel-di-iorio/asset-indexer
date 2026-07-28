import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'main.js',
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
