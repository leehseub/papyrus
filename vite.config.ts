import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Electron의 file:// 프로토콜에서 상대 경로 필요
  base: command === 'build' ? './' : '/',
}))
