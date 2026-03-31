import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [
        /node_modules/,
        /src\/lib\/grpc\/generated\/.*_pb\.js$/,
      ],
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
