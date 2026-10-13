import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
    },
    // Enforces the import directions ARCHITECTURE.md describes.
    //
    // Patterns match the import specifier as written, so they are anchored with
    // `**/` rather than spelled relatively: `../usecase/*` stops matching the
    // moment a layer gains a subdirectory and one more `../` appears, which
    // would drop the boundary without failing any check.
    //
    // A more specific override replaces this rule rather than merging into it,
    // so each layer restates every boundary that applies to it.
    overrides: [
      {
        files: ["src/domain/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/usecase/**",
              "**/infrastructure/**",
              "**/presentation/**",
              "**/composition/**",
            ],
          }],
        },
      },
      {
        files: ["src/usecase/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/presentation/**",
              "**/composition/**",
            ],
          }],
        },
      },
      {
        files: ["src/infrastructure/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/usecase/**",
              "**/presentation/**",
              "**/composition/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
            ],
          }],
        },
      },
      // Keep these after src/presentation/**: the last matching override wins.
      // Patterns match directory names in import specifiers, so adding a
      // directory such as domain/search/ would also restrict imports of it.
      {
        files: ["src/presentation/shared/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/labels/**",
              "**/kanban/**",
              "**/table/**",
              "**/search/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/labels/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/kanban/**",
              "**/table/**",
              "**/search/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/kanban/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/table/**",
              "**/search/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/table/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/kanban/**",
              "**/search/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/search/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/kanban/**",
              "**/table/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/filter/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/kanban/**",
              "**/table/**",
              "**/search/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/viewer/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/kanban/**",
              "**/table/**",
              "**/search/**",
              "**/filter/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/board/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/shell/**",
            ],
          }],
        },
      },
      {
        files: ["src/presentation/shell/**"],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/board/**",
            ],
          }],
        },
      },
      {
        files: [
          "src/presentation/context/**",
          "src/presentation/errors/**",
          "src/presentation/store/**",
        ],
        rules: {
          "no-restricted-imports": ["error", {
            patterns: [
              "**/infrastructure/**",
              "**/composition/**",
              "**/shared/**",
              "**/labels/**",
              "**/kanban/**",
              "**/table/**",
              "**/search/**",
              "**/filter/**",
              "**/viewer/**",
              "**/board/**",
              "**/shell/**",
            ],
          }],
        },
      },
    ],
  },
  plugins: lazyPlugins(() => [react()]),
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
