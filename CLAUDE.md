# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"fiche-halles" — a technical-preparation tool for Les Halles de Schaerbeek (a venue). It is an
object-based patch/diagramming canvas: drag equipment (consoles, converters, speakers, amplifiers)
onto a canvas and connect their ports with cables, with protocol/direction compatibility enforced
live during the drag. This canvas is step 1 of a longer-term vision (not yet built): the diagram
becoming the source of truth for a written technical spec, a PDF export, and a data file consumable
by a separate troubleshooting skill. Work happens feature-by-feature; don't build ahead of what's
asked.

The user (a régisseur/technical director) wants to understand *why* each structural decision is
made, not just get working code — explain the reasoning, especially anything non-obvious about
React/CSS/React Flow behavior.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — full build: `tsc -b && vite build`.
- `npx tsc --noEmit -p tsconfig.app.json` — type-check only. **Do not run bare `npx tsc --noEmit`** —
  the root `tsconfig.json` has `"files": []` plus project references (`tsconfig.app.json` /
  `tsconfig.node.json`), so the bare command silently checks nothing and reports success no matter
  what is broken.
- `npm run lint` — `oxlint`.
- No test framework is set up (no vitest/jest); there are no automated tests in this repo.
- Manual verification is done in a running browser. When checking interaction/CSS behavior (hover
  states, drag-and-drop, connection validity, pixel alignment), install `playwright` as an ephemeral
  devDependency (`npm install -D playwright`, `npx playwright install chromium`), write a throwaway
  script, run it, delete the script, and `npm uninstall playwright` — never leave it as a permanent
  dependency. HTML5 drag-and-drop (the palette → canvas drop) does not work with Playwright's plain
  mouse events; simulate it by dispatching real `DragEvent`s with a `DataTransfer` via
  `page.evaluate`. A real multi-step `page.mouse.move` is required to trigger CSS `:hover` reliably —
  `.hover({force:true})` produces false negatives here.
- To verify color contrast (WCAG ratio) with Playwright: `getComputedStyle(...).color` does **not**
  resolve `oklch(...)` to `rgb(...)` in current Chromium — it hands back the `oklch()` string
  unparsed, so regex-matching it as `rgb(...)` fails silently. Render the color into a 1×1
  `<canvas>` and read it back with `getImageData` to force real sRGB byte conversion.

## Architecture

### domain/ vs canvas/ split

`src/domain/` is plain TypeScript with **no import of React or `@xyflow/react`** — it holds the data
model (`equipment.ts`: `Protocol`, `Port`, `DeviceModel`, `DeviceCategory`), the device catalog
(`catalog.ts`), and business rules (`compatibility.ts`: `canConnectPorts`, protocol/direction
matching). This separation exists so the model can later be reused to generate the written spec and
the exported data file for the troubleshooting skill, without being entangled in rendering code.

`src/canvas/` is the React Flow rendering/interaction layer. It never encodes business rules
directly — `connectionValidation.ts` is the sole bridge between React Flow's `isValidConnection`
callback and `domain/compatibility.ts` (it also enforces "one cable per port" via `edges`, which is
UI-session state, not a domain rule). This same function transparently drives React Flow's built-in
live drag feedback (`.valid`/`.invalid` on the in-progress connection line, `.connectingto` on the
hovered handle) — no separate code path needed for that, only CSS.

### Catalog editing

The user hand-edits `src/domain/catalog.ts` directly (adding real device models, reordering ports).
**Always preserve the user's exact port names/numbers verbatim** — never invent a naming convention
(e.g. don't renumber or relabel ports to fit a pattern).

### Port groups and visibility

`canvas/portVisibility.ts` computes which ports a device shows/hides — computed fresh from a
device's port list (not a static enum). Analog In/Out are chunked into groups of 8; other protocols
group as a whole (Aux, MIDI, "other" catch-all) or stay always-visible (Dante/AES50/Snake/Ethernet/
Speakon are never groupable). All groups start hidden by default (`allGroupsHidden`), so a freshly
dropped device shows only its ungroupable ports until the user toggles a group on.

### Routing (`canvas/routing.ts`)

Pure geometry, no React/React Flow imports. A* pathfinding on a grid for cable paths that avoid
device boxes and reduce overlap between cables. Key distinction: `blockedForSourceStub` /
`blockedForTargetStub` exclude only the port's *own* node (so a cable can leave its own box), while
`blockedForSearch` (the main A* search) excludes nobody — this is what stops a cable cutting through
the target's own body or a third-party device.

`FlowCanvas.tsx` recomputes routes in a `useMemo` keyed on `nodes` (our own controlled state, which
reliably changes reference every drag frame), then reads a **fresh** `nodeLookup.get(id)?.internals.
handleBounds` snapshot from the React Flow store imperatively inside that memo — not from a value
captured by React Flow's internal store reference, which doesn't reliably change during a drag.
React Flow only remeasures a handle's `handleBounds` when its *size* changes (`ResizeObserver`), not
when only its position shifts via CSS — a pure CSS position tweak on already-mounted handles can
leave routing using stale coordinates until something forces a remeasure (move the node, or reload
the page).

### Theming (`src/styles/theme.css`)

Three-layer architecture, deliberately kept in sync by hand (no build-time indirection):

1. **Primitives** (`--bp-*`) — raw Blueprint theme values.
2. **Semantic** (`--canvas-bg`, `--signal-*`, `--accent`, `--invalid`, `--palette-*`,
   `--device-*-bg`, etc.) — what each token *means*; this is the only layer components should read.
3. **React Flow bridge** (`.react-flow { --xy-*: var(--...) }`) — copies semantic tokens into the
   `--xy-*` variables React Flow actually reads, scoped to `.react-flow`.

A `[data-theme="print"]` variant (a future light/printable theme) is meant to only redefine layer 2.

`theme.css` is imported in `main.tsx` **after** `App` specifically so it loads after React Flow's own
`@xyflow/react/dist/style.css` (imported inside `FlowCanvas.tsx`) — CSS specificity ties break by
source order, and this import order is what lets our tokens/rules win.

Per-protocol and per-device-family colors live in dedicated modules
(`canvas/protocolColors.ts`, `canvas/deviceColors.ts`) that map domain data (protocol / device
category+name prefix) to CSS variable references — consumed by both the port circles and the cable
rendering (protocols) or the device card background (families: console/DL/DN/Nxamp/other), so the
mapping is defined once. Device-family classification is presentation-only and intentionally does
not live in `domain/catalog.ts`.

**Convention: give every new decorative color its own dedicated primitive + semantic token pair**
(e.g. `--bp-palette-grad-*`, `--bp-device-*`) instead of reusing an existing semantically-loaded
token that happens to look right (e.g. don't point a new decoration at `--bp-signal-aes50` or
`--bp-invalid`). This has been done deliberately for the palette gradient, the device-family colors,
and the invalid-connection red — a future change to a protocol/alert color must never accidentally
shift an unrelated decoration.

### The recurring CSS/React gotcha

**An inline `style` prop always beats a CSS class rule**, including `:hover` and `.selected`. The
codebase's convention: only properties that vary *per instance* (a port's protocol color, a cable's
stroke color, a device card's family color) go in inline `style` (typed via a local
`CSSProperties & { "--custom-var"?: string }` extension when a CSS custom property needs to be set
from JS); everything constant goes in a CSS class so that `:hover`/`.selected`/state-class rules can
still override it. Where a dynamic inline color genuinely must be overridden by a temporary
interaction state (e.g. the red "invalid connection" feedback overriding a port's protocol color),
`!important` is used deliberately and sparingly — that's the one sanctioned place for it.

Related gotcha: toggling an element's `position` from `static` to `relative` only inside a `:hover`
rule can visibly shift the element even with no explicit offset (it perturbs flex centering, and it
also re-activates any `top`/`left`/`right` percentage offsets set by *other* rules — e.g. React
Flow's own `.react-flow__handle-left/-right` — that were inert under `position: static`). Keep
`position` constant across states and neutralize any inherited offset properties explicitly rather
than relying on `static` to suppress them.

### Full-bleed layout

`#root` in `index.css` was originally the Vite template default (capped at `1126px`, centered) —
it's now full-width/full-height on purpose, since real patch layouts need the whole screen. Keep
that in mind if touching `index.css` or `App.tsx`'s top-level flex layout (`Palette` fixed-width on
the left via `--palette-width`, `<main>` with `flex: 1` taking the rest).

### Custom node types get no free CSS

React Flow's built-in selection/hover rules only target its own built-in node-type classes
(`.react-flow__node-default` etc.) — a custom node type (`.react-flow__node-device` here) is never
matched by them, regardless of the `--xy-*` variables set. Custom selection/hover rules have to be
written by hand in `theme.css`'s "RÈGLES PERSONNALISÉES" section (and watch for React Flow's own
higher-specificity rules, like `.react-flow__node.selectable:focus { outline: none }`, silently
cancelling a same-specificity custom rule — match the extra class to win).
