import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/spin-the-wheel-customized/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { motion: ["framer-motion"], validation: ["zod"] },
      },
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
