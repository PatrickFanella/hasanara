# Source of this frontend

HasanAra owns its frontend. The owner decided that Rekolekt becomes a headless core and that each archive builds and owns its whole frontend, so this directory was copied out of the core rather than built from it.

## Import

| | |
| --- | --- |
| Source repository | `https://git.subcult.tv/subculture-collective/rekolekt` (formerly `transcript-create`) |
| Source commit | `19124a7fec867057919d8ce3aac474c7c25695cf` (`release/v0.1.0-rc.18`, the release hasanara.tv served when this was imported) |
| `frontend/` | 188 files, tree `920ff48e8de9dc2f6e1b35f559a699581653de2a` |
| `e2e/` | 11 files, tree `d72c21f59c6a90230e1bace520094ad8168176c3` |
| File-list hash, `frontend/` | `cbf9bb34d6c5cc9bfbdcf0e3f10b51b3783435617f24275789c251b0ffa0e069` |
| File-list hash, `e2e/` | `2c78882b0148a5cbcaca7d93c7eacf8b86ef65e38e98f3d2146a539196ef472b` |

The file-list hash is the SHA-256 of `git ls-tree -r 19124a7 -- <directory>` run in the core checkout; it covers every path, mode and blob ID. Both directories were added with `git subtree add` from `git subtree split --prefix=<directory> 19124a7`, so `git log -- frontend` and `git log -- e2e` show their core history. The import commits contain the trees above unchanged.

To check the import, run from the repository root:

```bash
git -C core ls-tree -r 19124a7 -- frontend | sha256sum
git rev-parse <import commit>:frontend    # 920ff48e...
```

## Changes after the import

Changes are ordinary commits after the import; `git diff 920ff48e8de9dc2f6e1b35f559a699581653de2a HEAD:frontend` lists them.

- `Dockerfile` pins `node:20-alpine` and `nginx:1.27-alpine` to digests. The nginx digest has the same base layers as the rc.18 web image.
- `api:generate` and `api:check` read the committed OpenAPI document of the pinned core, `../core/docs/api/openapi.json`, instead of generating it from the core application. `scripts/check-api-types.mjs` does the comparison.
- `e2e/tests/archive-smoke.spec.ts` reads the Northstar test profile from `../core/config/branding/`.

The build still reads the brand profile the same two ways: the app fetches `/api/site` at runtime, and `scripts/render-site-metadata.py` writes the crawler metadata and `/social-preview.png` when the container starts.
