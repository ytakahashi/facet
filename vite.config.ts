/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `tauri dev` loads devUrl (http://localhost:5173) whatever Vite does.
    // Without strictPort, a taken port makes Vite move to the next one while
    // the window keeps loading whichever server holds 5173.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "node",
    // The board-validation skill's tests run under Deno (`deno test`);
    // picked up here they would only fail on the Deno globals they exercise.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
