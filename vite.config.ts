/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // The desktop host's tests run under Deno, against a real file system;
    // picked up here they would only fail on the Deno globals they exist to
    // exercise.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
