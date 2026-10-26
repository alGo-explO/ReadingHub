import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'production') {
    if (!env.VITE_API_URL) throw new Error('VITE_API_URL is required for production builds');
    if (!env.VITE_API_URL.startsWith('https://')) {
      throw new Error('VITE_API_URL must use HTTPS in production');
    }
  }
  return {
    plugins: [react()],
    server: { port: 3000 }
  };
});
