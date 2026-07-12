# Facet

A local-first Markdown kanban desktop app.

- Opens a YAML board file and renders the Markdown files it references as cards
- Markdown files stay plain — no task-management metadata is embedded in them
- The same Markdown files can be used differently across multiple board files

## Tech Stack

- React + Vite (SPA)
- TypeScript
- [Deno Desktop](https://docs.deno.com/runtime/desktop/) (desktop runtime,
  `webview` backend)
- Zustand (state management)

## Commands

### Frontend

- `deno task dev` — start the Vite dev server
- `deno task build` — type-check and build the production bundle (`dist/`)
- `deno task preview` — preview the production build in a browser
- `deno task lint` — run oxlint

### Desktop app

- `deno task desktop` — build the app and package it as `Facet.app`
- `deno task desktop:hmr` — run the desktop app with hot module reload

### Formatting

- `deno fmt` — format the codebase
