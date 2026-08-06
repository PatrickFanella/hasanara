# Web Interface Guidelines audit

## Changed UI files

- `frontend/src/index.css`: pass — semantic tokens meet AA in automated light/dark route scans; reduced-motion and visible focus rules remain intact.
- `frontend/src/routes/AppLayout.tsx`: pass — skip link retains a visible themed focus state; footer inline link has a non-color cue.
- `frontend/src/routes/ExplorePage.tsx`: pass — selected tab exposes `aria-pressed` and theme-aware contrast.
- `frontend/src/routes/VideoPage.tsx`: pass — async save/remove feedback uses a status message and specific action labels.
- `frontend/src/components/video/FormattedTranscriptDocument.tsx`: pass — action is a semantic button and accurately exposes save/remove state.
- `frontend/src/components/video/PlainTranscriptTurns.tsx`: pass — action is a semantic button and accurately exposes save/remove state.
- `frontend/src/components/video/PlayerPanel.tsx`: pass — invariant black media chrome uses a contrast-safe invariant token.

## Automated evidence

- 11 public/protected/error routes scanned in light and dark schemes with no serious or critical axe violations.
- Core public routes have no document-level horizontal overflow at 320 px.
- Mobile menu closes on navigation and restores focus to its trigger on Escape.

