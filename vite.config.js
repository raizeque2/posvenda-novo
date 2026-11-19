import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { previewIsolation } from './scripts/preview-isolation.mjs'
import {localDatasetPlugin} from './scripts/local-dataset.mjs'

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': path.resolve('./src'),
      // jsPDF importa html2canvas para o plugin .html() — que não usamos.
      // O stub evita 201 kB extras no bundle do PDF.
      'html2canvas': path.resolve('./src/stubs/html2canvas.js'),
    },
  },
  define: {
    // Carimbo de versão (data/hora do build) — exibido no rodapé para
    // comparar rapidamente se duas máquinas rodam a mesma versão do app.
    __BUILD_ID__: JSON.stringify(
      new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    ),
    // Versão em número (epoch ms) pro app comparar com config/appVersion e
    // avisar sozinho quando existe uma versão mais nova no ar (02/09/2026,
    // ver App.jsx VersaoBanner + scripts/pos-deploy.cjs). VITE_BUILD_TS é
    // passado pelo próprio comando de deploy — os dois usam o MESMO instante.
    __BUILD_TS__: JSON.stringify(Number(process.env.VITE_BUILD_TS) || Date.now()),
  },
  plugins: [mode === 'preview' && localDatasetPlugin(loadEnv(mode,process.cwd(),'').POSVENDA_LOCAL_DATASET), mode === 'preview' && previewIsolation(), react()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          ...(mode === 'preview' ? {} : { 'vendor-webchannel': ['@firebase/webchannel-wrapper/webchannel-blob'], 'vendor-firestore': ['firebase/firestore'], 'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/storage', 'firebase/functions'] }),
          // Bibliotecas grandes que só algumas telas usam ficam em pedaços
          // próprios: login e portal não baixam gráfico, animação nem Markdown.
          'vendor-charts':   ['recharts'],
          'vendor-visx':     ['@visx/shape', '@visx/scale', '@visx/group', '@visx/responsive', '@visx/grid', '@visx/gradient', '@visx/pattern', '@visx/curve', '@visx/event'],
          'vendor-d3':       ['d3-array', 'd3-shape'],
          'vendor-motion':   ['motion'],
          'vendor-state':    ['zustand'],
        },
      },
    },
  },
}))
