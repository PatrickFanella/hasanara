# Design system

**Status:** shipped baseline (2026-07-12).

The React 19 frontend uses shared semantic classes in `frontend/src/index.css`: surfaces, archive sections, action links, buttons, badges, pills, alerts, and typography. Components must use theme tokens, targeted transitions, declared image dimensions, and no inline styles (required by CSP).

Light- and dark-theme text tokens must maintain at least WCAG AA 4.5:1 contrast on every semantic surface where they are used. Accent-filled controls use `text-accent-contrast`; invariant black media chrome uses `text-player-accent`; inline links within prose must include a non-color cue such as an underline.

Prefer presentational sections backed by query hooks, URL adapters, mutation controllers, and view models. Route state belongs in the URL when it must be shareable. All routes are lazy loaded; admin code must remain outside public route downloads. Gzip budgets are 150 KiB for the shell plus initial route and 100 KiB per lazy route.
