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
Speakon are never groupable). All groups start hidden by default (`defaultHiddenGroups`), except
Analog In on an `amplifier` category device (visible by default — a Nxamp only has 4, hiding them
gains nothing). A device with `DeviceModel.layout === "horizontal"` (network switches, HF racks)
bypasses this whole group/hide system: `DeviceNode.tsx` renders a single row of always-visible ports
instead of the usual two columns, with no toggle buttons at all — see `groupPortsByVlan` and
`isHorizontal` in that file. `Port.group` (e.g. a switch's VLAN name, or just a label like "Analog
Out") drives the little heading shown above a cluster of ports in that layout; it's presentation-only
and has no effect on connection rules.

Separately, the toolbar's "Masquer les ports inutilisés" is a *display filter*, not a `hiddenGroups`
mutation: `FlowCanvas.tsx`'s `displayNodes` memo (same derived-not-stored pattern as `routedEdges`,
see below) injects `hideUnusedPorts` + a live `usedPortIds` set into each device node's data every
render; `DeviceNode.tsx` combines that with the group-hidden filter (`isUsed`, checked in addition to,
not instead of, group visibility) and also hides the toggle-button bar entirely while it's on.

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

### Canvas node types and the derived-for-render pattern

`FlowCanvas.tsx` manages three node types in one `CanvasNode = DeviceNodeType | TextNodeType |
RectNodeType` union: `device` (the equipment cards), `text` (free-form notes, `TextNode.tsx`) and
`rect` (layout frames, `RectNode.tsx`). `text` and `rect` are purely decorative — independent of
`domain/`, excluded from cable-routing obstacles (the `node.type === "device"` filter in
`routedEdges`), and untouched by the device-only logic in `onToggleGroup`/`displayNodes` (each narrows
on `node.type` before touching type-specific `data` fields). Adding a fourth decorative node type
should follow the same three exclusions.

Established convention for anything that needs to reflect current `nodes`/`edges` state but shouldn't
be persisted back into it: compute it in a `useMemo` keyed on the state it reads (`routedEdges` for
cable paths, `displayNodes` for the hide-unused-ports overlay), and feed the *derived* value to
`<ReactFlow>`, never write it back via `setNodes`. This keeps the controlled `nodes`/`edges` state as
the single source of truth and avoids feedback loops.

### Toolbar tools and the pane-click deselection gotcha

`Toolbar.tsx`'s `activeTool` (`pan`/`select`/`text`/`rect`) switches how a plain drag on empty canvas
behaves. React Flow exposes `onPaneClick` (single click) but no `onPaneMouseDown`/`onPaneMouseUp` —
a drag-to-draw tool (`rect`) is implemented with raw `onMouseDown`/`onMouseMove`/`onMouseUp` on the
wrapping `<div>`, gated on the mousedown target being exactly `.react-flow__pane` (never a node).

Non-obvious failure mode this ran into: a plain mousedown+mouseup (no real drag) always fires a
trailing native `click` afterward, which React Flow uses internally to deselect everything on the
pane — and that click is dispatched *after* your own `mouseup` handler runs. Marking the
just-drawn/just-created node `selected: true` inside `onMouseUp` gets silently undone a moment later
by that deselection. Fix: don't select it in `onMouseUp` — stash its id in a ref and select it inside
`onPaneClick` instead, since React Flow calls that hook *after* its own deselection pass (this is also
why a `text` note created via `onPaneClick` was never affected — its selection was always being set
inside that same hook to begin with).

### Screen-space vs flow-space measurement

`getBoundingClientRect()` on any element inside `.react-flow__viewport` returns **screen pixels**,
already multiplied by the current zoom — but `node.width`/`node.height` (and anything else fed back
into node state) are in **flow-space** units, independent of zoom. `TextNode.tsx`'s auto-fit-to-text
sizing measures a hidden mirror `<span>` and must divide the measured `rect.width`/`rect.height` by
`useViewport().zoom` before using them — omitting this works fine at the default zoom (1) but breaks
progressively at any other zoom level (each keystroke's mis-scaled measurement compounds, converging
the box toward its minimum size). Any future measure-a-DOM-node-for-sizing code needs the same
division.

### Custom devices and the open `DeviceCategory` type

Users can create devices from the UI (Palette's "+ Nouvel appareil", `CreateDeviceForm.tsx`) in
addition to the hand-edited `domain/catalog.ts`. `domain/CatalogContext.tsx` provides the merged list
(`useCatalog()`) plus `addCustomDevice`/`updateCustomDevice`/`deleteCustomDevice`; custom devices are
persisted to **`localStorage`** (`domain/customDevices.ts`), not to `catalog.ts` — they're local to
the browser, not shared or committed. `Palette.tsx` shows an edit/delete button pair only on entries
whose id is in `customDeviceIds`, never on built-in catalog entries. Editing keeps the same device
`id` even if the name changes (regenerating it would be pointless churn, nothing currently references
devices by a "stable name"). `DeviceCategory` (`domain/equipment.ts`) was widened from a closed union
to known-literals-plus-`(string & {})` specifically so users can type an arbitrary new category name
from the form while existing code (autocomplete on the known ones) still works.

### Custom node types get no free CSS

React Flow's built-in selection/hover rules only target its own built-in node-type classes
(`.react-flow__node-default` etc.) — a custom node type (`.react-flow__node-device` here) is never
matched by them, regardless of the `--xy-*` variables set. Custom selection/hover rules have to be
written by hand in `theme.css`'s "RÈGLES PERSONNALISÉES" section (and watch for React Flow's own
higher-specificity rules, like `.react-flow__node.selectable:focus { outline: none }`, silently
cancelling a same-specificity custom rule — match the extra class to win).
