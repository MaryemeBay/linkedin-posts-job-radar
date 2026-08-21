# Vacancy Radar viewer

The React dashboard served by the `start_viewer` MCP tool. A separate Vite
project, built to `dist/` and copied into `build/viewer/web` by the root
`copy-viewer` script — the Express server in `src/commands/viewer.ts` serves that
bundle as static files, so there is no Vite dev server at runtime.

## Working on it

```bash
npm install          # from this directory
npm run dev          # Vite dev server on :5173
npm run build        # type-check and bundle to dist/
```

`npm run dev` serves the UI but not the API. The dashboard calls `/api/posts` and
`/api/filter-state` on its own origin, so run the full viewer
(`npm run viewer` from the repo root, on :7391) when you need live data.

After changing anything here, rebuild from the repo root so the served bundle is
refreshed:

```bash
cd ../../.. && npm run build
```

## Structure

| Path | Role |
| --- | --- |
| `src/App.tsx` | Shell, theme, filter state, polling, filter predicate |
| `src/components/FilterView.tsx` | Filter bar: selects, segmented controls, active pills |
| `src/components/LinkedInPostCard.tsx` | Card view, including stripping LinkedIn's own interface text out of post bodies |
| `src/components/TableView.tsx` | Editable table view |
| `src/components/StatsBar.tsx` | Headline counts |
| `src/index.css` | Design tokens for both themes |

## Theming

Colours are CSS variables on `:root` and `.dark` in `src/index.css`, exposed as
semantic Tailwind names (`bg-surface`, `text-muted`, `border-line`) in
`tailwind.config.js`. Add colours there rather than reaching for a literal
`slate-*` class, or the component will only look right in one theme.

The theme is stored per browser in `localStorage` and defaults to the OS setting.

## State sync

Filters are mirrored to `~/.linkedin-mcp/filter-state.json` through
`/api/filter-state`, which is what lets the `viewer_filters` MCP tool drive the
dashboard from a conversation. The app polls posts every 3s and filter state
every 1.5s, guarding against feedback loops with a syncing flag.
