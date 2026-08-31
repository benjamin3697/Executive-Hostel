import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call /api/... during `npm run dev` without CORS
      // hassle; in production, point VITE_API_BASE_URL at the real API URL
      // instead (see src/lib/api.ts).
      "/api": "http://localhost:4000",
    },
  },
});
