import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true espone il server sulla rete locale (non solo su localhost),
  // utile per testare da tablet/telefono in cucina — vedi brief §3.6.
  server: {
    host: true,
  },
})
