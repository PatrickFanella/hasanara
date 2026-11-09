# HasanAra — Broadcast service / Screenprint

Selected from the owner-supplied PBS merchandise references on November 8, 2026. The owner permitted changes to the design system while retaining the site structure, and requested the Studio pack update. This document describes the local implementation; it does not claim a production deployment.

## Identity and source ownership

Studio owns the identity master at `studio/brand-tools/references/hasanara-broadcast-master.svg` in `subcult-tv`. HasanAra owns its interface in `frontend/src/index.css` and the runtime profile in `branding/brand.json`. Studio's `brands/hasanara/` pack contains the corresponding tokens, web exports, promotional layouts, source hashes and guide.

The new vector interpretation uses a tower, three signal rings, a star and a block-letter PBS station plate. It draws on the supplied references without tracing the merchandise logo. The serif red-and-paper system and the older face-profile PBS mark are superseded by this selection.

| Product asset | Studio source/export | Application |
| --- | --- | --- |
| `branding/assets/logo.svg` | `references/hasanara-logo.svg`; pack `product/logo.svg` | Header and home emblem |
| `branding/assets/favicon.svg` | `references/hasanara-favicon.svg`; pack `product/favicon.svg` | Tab icon; startup renderer creates the touch icon |
| `branding/assets/social-card.svg` | `references/hasanara-social-card.svg`; pack `product/social-card.svg` | Startup renderer creates the 1200×630 PNG social preview |
| `branding/assets/badge.svg` | Full emblem geometry with a charcoal square background | Standalone square emblem |

`branding/logo.source.svg` and `branding/social-card.source.svg` retain editable source geometry and caption text. Their outlined exports are copied from the selected Studio source. Export editable SVGs with Inkscape's `--export-text-to-path --export-plain-svg --export-filename=...`; the outlined assets have no font or external image dependency. The social source inlines the logo geometry; keep it synchronized when changing the master.

At small sizes use the tower favicon. The full emblem starts at 160px in promotional work. The 64px header emblem is paired with the readable HasanAra name. Standalone marks need clear space of one quarter of their height. Preserve the SVG proportions and the 360×264 home image dimensions to avoid a layout shift on image load.

## Palette

The main print palette is charcoal `#25272c`, warm yellow `#efbd48`, vermilion `#ff751a`, warm white `#fff9eb` and burgundy `#b52032`. Cyan `#238da8`, taken from the pin reference, is optional editorial artwork rather than an interface action color.

The light theme uses dark red for readable links and white button text. Orange and burgundy are decorative marks, not small text colors. The theme profile overrides the complete surface and text palette, so application defaults and runtime branding agree.

| Role | Dark | Light |
| --- | --- | --- |
| canvas | `#25272c` | `#f7f3e8` |
| surface | `#2e3137` | `#fffcf4` |
| surface-muted | `#35383f` | `#eee7d7` |
| surface-raised | `#3d4048` | `#fffdf7` |
| ink | `#fff9eb` | `#2b2528` |
| muted | `#d4cfc4` | `#554e4b` |
| subtle | `#b6b2aa` | `#6b6157` |
| border | `#61636b` | `#8d887d` |
| border-strong | `#a5a49e` | `#353033` |
| accent | `#efbd48` | `#a92c20` |
| accent-hover | `#ffcf66` | `#852016` |
| accent-soft | `#443a27` | `#f8e2ca` |
| accent-contrast | `#25272c` | `#ffffff` |
| accent-2 | `#ff751a` | `#ed650c` |
| accent-3 | `#b52032` | `#b52032` |

## Type and interface rules

- Display: Inter Tight 800–900. Page titles use compact sentence case; the station wordmark retains its display treatment. Episode titles and chapter headings use upright bold sans type.
- Body and controls: Inter Tight 400–700. Station labels use Inter Tight 800, 11px, uppercase, with 0.1em tracking.
- Reading: Newsreader for transcript prose and search excerpts. Timecodes and counts keep JetBrains Mono.
- Fonts load through the existing Google Fonts stylesheet; the application has system fallbacks. Studio bundles licensed font files. The startup share card uses outlined DejaVu Sans Bold for portability.
- Keep content above the fold with 24–30px page titles, compact page introductions, and quiet inline metadata. Use the existing routes and search contracts; `/timeline` redirects to Explore month browsing. Corners stay between 0 and 3px.
- Panels have a solid outline. Reserve the vermilion top rule for mastheads and selected broadcast components; ordinary content sections use a single border. The search command has a small hard orange offset.
- Active navigation and primary actions use the theme's accent fill and accent-contrast text. Focus is a 2px accent outline with a 2px offset. Controls keep their current keyboard semantics and 44px primary targets.
- Flat fills replace paper grain, halftone backgrounds and the blurred desktop header. Loading, empty, error and account states retain their existing copy and recovery actions.
- The header emblem remains visible on narrow screens; the home page leads with search and recent recordings. The desktop navigation collapses below 64rem, and stacked mobile sections retain their ordering. Reduced motion disables the ticker and nonessential animation.

## Verification

Use the existing frontend unit suite, build, lint and format checks. `e2e/tests/archive-smoke.spec.ts` covers search, archive browsing, keyboard behavior, mobile navigation, 320px reflow and both themes. For this branding pass, `output/brand-qa.json` and the matching screenshots record a separate browser check with the actual profile, seeded archive responses, both themes and 1440/390/320px widths. Fixture screenshots are not captures of production data.

The Studio pack rebuild uses `BRAND_ONLY=hasanara PYTHONPATH=../studies/clpr-directions python3 build_packs.py` from `studio/brand-tools/`, followed by the filtered video renderer and another pack build to refresh the manifest. Recheck copied source hashes after a refresh. A source build, hosted CI, deployment and live-site verification remain separate results.

## Archive interaction refinements

Explore requests up to 20 topic cards, shows 12 initially, and offers a shuffle. Period topics lead the list. Its VOD collection uses the cursor-paginated broadcast-date library instead of the representative evidence sample; cards keep their natural height beside cited moments.

The desktop Watch layout keeps the topic navigator on the left and places the player between transcript search and the transcript. The navigator and search controls can collapse. The header, search and player stay sticky while the transcript scrolls. Quote navigation accounts for the visible dock and does not enable playback following until requested. The mobile sheet layout remains separate.

The main header contracts after scrolling. Its measured height supplies sticky offsets. The Wire has a colored label, a far-left hide control and a separate pause icon. Hiding it slides the bar up and leaves a 24 px square so it can be reopened; the choice persists. The VOD library uses a compact search row with date controls in a disclosure. Saved searches support fixed dates and rolling 7/30-day ranges resolved when reopened, using UTC calendar dates including today.

The homepage stats share one centered row, and the recorded runtime uses days, hours and minutes. Popular searches read `/search/popular` and leave out a short list of generic words. Section labels use `eyebrow-rule`, the eyebrow with an orange line beneath it.

About pairs archive facts computed from the live summary with an FAQ. Support follows Studio's `studio/content/patreon/support-redesign-2026-10/site-guidelines.md`: quiet footer/About placement and clear SUBCULT recipient wording, without reward or price claims. The page is one short panel using that guide's HasanAra copy. Studio social URLs follow `src/lib/social-links.ts` in subcult-tv and appear as labelled footer icons (Simple Icons, CC0) only for the SUBCULT operator profile. Other operators retain their configured identity and support flow.
