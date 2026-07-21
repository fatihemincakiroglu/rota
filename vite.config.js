import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Her dil kendi klasorunde bir index.html olarak servis edilir.
// "/" (Ingilizce, x-default) + 8 dil klasoru.
const LANG_DIRS = ['tr', 'es', 'ar', 'hi', 'fr', 'ru', 'pt', 'de']

const input = { main: resolve(__dirname, 'index.html') }
for (const d of LANG_DIRS) {
  input[d] = resolve(__dirname, d, 'index.html')
}

export default defineConfig({
  plugins: [react()],
  build: {
    // maplibre-gl buyuk (~800kB); ayri bir chunk'a alinca ana paket kucuk
    // kalir ve tarayici bunlari paralel/onbellekli yukleyebilir.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input,
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/react')) return 'react-vendor'
        },
      },
    },
  },
})
