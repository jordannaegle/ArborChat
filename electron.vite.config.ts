import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import crypto from 'node:crypto'

// Polyfill crypto.hash for Node.js < 21
if (!crypto.hash) {
  // @ts-ignore - altering global crypto type
  crypto.hash = (algorithm, data, outputEncoding) => {
    const hash = crypto.createHash(algorithm)
    hash.update(data)
    if (outputEncoding) {
      return hash.digest(outputEncoding)
    }
    return hash.digest()
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/utils'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/utils'] })]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
