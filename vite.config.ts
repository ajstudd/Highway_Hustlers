import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
// Server-only middleware: the same API runs locally and as a Vercel Function.
// @ts-ignore Node module intentionally lives outside the browser source tree.
import { createCms } from './server/cms.mjs'

export default defineConfig(({ mode }) => ({
  plugins: [react(), { name: 'hh-content-api', configureServer(server) {
    const handler = createCms({ ...process.env, ...loadEnv(mode, process.cwd(), '') });
    server.middlewares.use('/api/cms', (req, res) => { req.url = `/api/cms${req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`; void handler(req, res); });
  } }],
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
