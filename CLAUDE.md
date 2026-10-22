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

- `npm run dev` — start the Vite dev server. On Windows, stopping the background `npm run dev` task
  does not kill its child `node` process — a restart then silently lands on port 5174. Free the port
  (find the listener with `Get-NetTCPConnection -LocalPort 5173`, `Stop-Process` it) before relaunching.
- **Write each file in a single write while the dev server runs.** Several rapid successive writes to
  the same file (e.g. a script doing one replace-and-save per edit) can leave Vite serving an
  *intermediate* version on Windows — it once served a `deviceColors.ts` where `familyOf` already
  returned `"atem"` but `FAMILY_CONFIG` had no `atem` entry yet, crashing the whole React tree (white
  page, no error boundary) on drop. `tsc` passes in that state since the disk file is correct; `touch`
  the file to force a recompile.
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

Cross-protocol compatibility lives in `compatibleProtocolPairs` (`compatibility.ts`) and is **not
transitive** — every pair must be declared explicitly. Current pairs: Aux↔Analog, Thunderbolt↔
MiniDisplayPort, Thunderbolt↔HDMI, MiniDisplayPort↔HDMI, DVI↔HDMI (passive adapters; DVI carries
no audio, so a DVI↔HDMI link is picture-only). There is deliberately no
Thunderbolt↔USB pair: the catalog's Thunderbolt ports are Thunderbolt 2 (Mini DP connector), which
has no passive USB adapter — only Thunderbolt 3/4 (USB-C) is USB-compatible, so a future TB3 device
needs its own protocol rather than a widened rule.

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
Speakon/HDMI/MiniDisplayPort/SDI are never groupable; USB/Thunderbolt and the projector-style
legacy/control protocols RGB/DVI/Serial/Remote fall in "other"). All groups
start hidden by default (`defaultHiddenGroups`), except Analog In on an `amplifier` category device
(visible by default — a Nxamp only has 4, hiding them gains nothing), and every group of a
`"video"`-discipline device (same reasoning: video devices have few ports). A catalog entry can
override all of this with `DeviceModel.initiallyHiddenGroups` (group ids like `"o"`, `"ain-1"`):
listed groups start hidden, all others visible — e.g. the Macbook hides `"o"` (USB/Thunderbolt) so
only HDMI/Minijack show at drop, the Panasonic PT-RZ770 hides `"o"` so only SDI/HDMI/LAN-Digital Link
show, and the ATEM Mini Pro hides `"ain-1"` (its Mic 1/2). Prefer this per-device field over widening a general rule when only
one device's real-world usage justifies it (a general "hide USB in video" rule was tried and wrongly
hid the only input of the USB-to-ethernet adapter). Likewise, `Port.alwaysVisible` pulls a single
port out of every group (never hidden, no button — a group left empty disappears with its button),
e.g. the Macbook's lone Minijack out, where an "Aout 1" toggle gained nothing.

A device with `DeviceModel.layout === "horizontal"` (network switches, HF racks)
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

Per-card port flip (the ⇄ button in a device card's title, `data.flipped` on the node, toggled by
`onToggleFlip` in `FlowCanvas.tsx`) hits exactly that: swapping the left/right columns moves every
handle to the other edge **without changing the card's size**, so React Flow never remeasures on its
own. Two pieces are needed, and both are load-bearing:
- `DeviceNode.tsx` calls `useUpdateNodeInternals()(id)` in a `useEffect` keyed on `flipped` (runs
  after the swapped DOM commits) to force the remeasure.
- That remeasure only updates React Flow's store (`set({})`), never our `nodes` state — React Flow
  emits a `dimensions` change only when the size actually changed. So `routedEdges` also depends on
  `handleBoundsKey`, a `useStore` selector that builds a string signature (side + node-relative x/y of
  every handle). It's a string so `useStore`'s `===` check suppresses re-renders when nothing moved;
  node-relative coordinates mean it stays stable during a plain node drag. The memo never reads it —
  it's only a trigger, hence the lint suppression on that dependency array.
Flip is a per-instance choice (stored in node data, not in `DeviceModel`), and horizontal-layout
cards get no button (all their ports are on the bottom edge).

### Theming (`src/styles/theme.css`)

Three-layer architecture, deliberately kept in sync by hand (no build-time indirection):

1. **Primitives** (`--bp-*`) — raw Blueprint theme values.
2. **Semantic** (`--canvas-bg`, `--signal-*`, `--accent`, `--invalid`, `--palette-*`,
   `--device-*-bg`, etc.) — what each token *means*; this is the only layer components should read.
3. **React Flow bridge** (`.react-flow { --xy-*: var(--...) }`) — copies semantic tokens into the
   `--xy-*` variables React Flow actually reads, scoped to `.react-flow`.

A `[data-theme="print"]` variant (light/printable, used for PDF export — see below) redefines only
layer 2, exactly as designed. One primitive had to become a semantic token retroactively to keep that
promise: the React Flow bridge originally pointed `--xy-edge-stroke-default` straight at the primitive
`--bp-line-600`; print needed to override that fallback stroke color without touching a primitive of
the *screen* theme, so it's now routed through a new semantic `--edge-default-stroke` token instead.

`theme.css` is imported in `main.tsx` **after** `App` specifically so it loads after React Flow's own
`@xyflow/react/dist/style.css` (imported inside `FlowCanvas.tsx`) — CSS specificity ties break by
source order, and this import order is what lets our tokens/rules win.

Per-protocol and per-device-family colors live in dedicated modules
(`canvas/protocolColors.ts`, `canvas/deviceColors.ts`) that map domain data (protocol / device
category+name prefix) to CSS variable references — consumed by both the port circles and the cable
rendering (protocols) or the device card background (families: console/DL/DN/Nxamp/Mac/ATEM/other), so the
mapping is defined once. Device-family classification is presentation-only and intentionally does
not live in `domain/catalog.ts`.

**Convention: give every new decorative color its own dedicated primitive + semantic token pair**
(e.g. `--bp-palette-grad-*`, `--bp-device-*`) instead of reusing an existing semantically-loaded
token that happens to look right (e.g. don't point a new decoration at `--bp-signal-aes50` or
`--bp-invalid`). This has been done deliberately for the palette gradient, the device-family colors,
and the invalid-connection red — a future change to a protocol/alert color must never accidentally
shift an unrelated decoration.

### Print / PDF export (`canvas/exportPrint.ts`, `RectNode.tsx`)

The Rectangle tool doubles as an export-zone selector: once a drawn `rect` node is selected, its
`NodeToolbar` (from React Flow — shown only while `selected`) offers an A4/A3 page-size choice plus
"Imprimer"/"PDF" buttons. `positionAbsoluteX/Y` + `width`/`height` from the rect's own `NodeProps`
give its bounds directly, in flow-space — no extra store query needed.

`exportPrint.ts` is plain TypeScript (no React), following the same reuse-for-later intent as
`domain/`: `getViewportForBounds` (from `@xyflow/react`) computes the `{x, y, zoom}` transform that
frames those bounds inside the target page's pixel dimensions (page size in mm → px at a fixed DPI,
minus print margins); `html-to-image`'s `toJpeg` captures `.react-flow__viewport` with that transform
applied via its own `style` override (a clone-only override — the live/visible canvas is never
touched); `jsPDF` embeds the resulting image and either triggers `doc.save()` (PDF download) or
`doc.autoPrint()` + opens the blob URL in a new tab (print, relying on the browser's own print UI for
that blob).

While capturing, `document.documentElement.dataset.theme` is set to `"print"` for the duration (inside
try/finally) so the `[data-theme="print"]` CSS variant (see Theming above) is active only for that
capture — this causes a brief, accepted flash on the live page, since CSS custom properties are
global and this isn't done inside an isolated iframe. Two lessons from getting this right:
- **PNG bloats through jsPDF's embedding path.** A ~450KB `toPng` capture became a ~10MB PDF; isolated
  by comparing the raw `dataUrl.length` against the final file size. Switching the whole pipeline to
  JPEG (`toJpeg`, quality `0.92`) dropped that to ~130KB with no visible quality loss for this
  text/line-heavy content — prefer JPEG here over "just compress the PNG harder."
- **The rectangle bakes itself into its own export** unless explicitly excluded: `toJpeg`'s `filter`
  option skips any DOM node whose `dataset.id` matches the rect's own React Flow `id` (threaded
  through as `excludeNodeId`), otherwise its border and resize handles show up in the captured image.

**Stacking-context gotcha specific to `NodeToolbar`:** its z-index derives from the node's own
`zIndex` (+1), but that only competes *within* `.react-flow__renderer`'s own fixed z-index (4, set by
the library) — structurally below `.react-flow__panel`'s fixed z-index (5), which is what the
persistent top-center canvas `<Toolbar>` uses. No inline `style={{ zIndex: ... }}` on a descendant can
outrank an ancestor stacking context's own rank relative to its siblings. A rectangle's export toolbar
positioned above the rect (`Position.Top`) could end up visually present but unclickable near the top
of the screen — a click there actually lands on the permanent toolbar underneath (confirmed via
`document.elementFromPoint`, and by walking the ancestor chain with `getComputedStyle` to compare
z-indexes). An inline `zIndex: 1000` stays in place as a secondary safety net for same-level overlaps
elsewhere (e.g. against a device card), but the actual fix is dynamic, not a fixed side: `RectNode`
computes, in **screen space** (`useViewport()`'s `y`/`zoom` combined with `useStore((s) => s.height)`
for the renderer's own pixel height — the node's own position/size are flow-space, see "Screen-space
vs flow-space measurement" below), whether there's room below the rectangle for the toolbar; if not,
it renders at `Position.Top` instead of `Position.Bottom`, and vice versa. A fixed `Position.Bottom`
alone traded the top-collision bug for a more common one: a rectangle whose bottom edge lands near the
bottom of the screen (framing a module that fills the visible canvas — an everyday case, not an edge
case) pushed the toolbar past the viewport's bottom edge — present in the DOM and "visible" by CSS,
but physically off-screen with no scroll to reveal it (full-bleed canvas, see "Full-bleed layout").
Since the flip only triggers when there's *no* room on one side, and a rectangle near the bottom of
the screen is by definition not also near the top, the two failure modes don't fight each other in
the common case.

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
a drag-to-draw tool (`rect`) is implemented with raw `onMouseDown`/`onMouseMove` on the wrapping
`<div>`, gated on the mousedown target being exactly `.react-flow__pane` (never a node).

Non-obvious failure mode this ran into (real bug, only visible in actual usage — not caught by the
first round of Playwright checks): the natural first instinct is to select the just-drawn rectangle
inside a `mouseup` handler on that same wrapping `<div>` (or to defer it one tick further, into
`onPaneClick`, reasoning that React Flow fires that *after* its own pane-deselection pass). Both are
unreliable, for two separate reasons:
- React Flow calls `stopPropagation()` on the native `mouseup` that ends a gesture on the pane, so a
  handler attached via React's normal synthetic bubble-phase delegation on an ancestor **never
  fires** at all — there's no click to catch later either.
- If the mouseup lands exactly on an *existing device node* (a very common case — rectangles are
  often drawn to frame existing devices), React Flow selects that node directly as part of its own
  mouseup handling, without waiting for any click — silently overriding the rectangle's selection
  even when the click-based approach does fire.

Fix: a native, capture-phase `window.addEventListener("mouseup", handler, true)` (registered in a
`useEffect`, capture phase always runs root-to-target before any descendant/library handler gets a
chance to stop it), which sets `selected: true` on the drawn rect directly and calls the native
event's own `stopPropagation()` to preempt React Flow's competing selection logic. A second guard —
`suppressNextClickRef` read inside `onClickCapture` on the wrapping `<div>` — swallows the trailing
synthetic `click` that still follows the mouseup, since that click would otherwise reach React Flow's
pane-deselection handling and immediately undo the selection just set. (A `text` note created via
`onPaneClick` doesn't need any of this — its selection is set inside that same click handler to begin
with, which already runs after React Flow's own deselection pass.)

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

### Discipline tabs in the palette (`domain/equipment.ts`'s `Discipline`)

`Palette.tsx` filters by **discipline** (Son/Vidéo/Lumière/Réseau — a tab bar) *before* grouping by
`DeviceCategory` (Consoles/Switches/...) — the existing category grouping is unchanged, just now
scoped to whichever discipline tab is active. `Discipline` is a closed union (`"son" | "video" |
"lumiere" | "reseau"`, `domain/equipment.ts`), deliberately **not** widened the way `DeviceCategory`
is: it's the venue's four fixed technical disciplines, not something a user invents per-device from
the creation form. Every `DeviceModel` (built-in and custom) requires one — the built-in catalog's
switches (`gigacore-luminex`, `netgear`) are `"reseau"`, the Macbook pro 2015 (`video-source`) and
the Blackmagic/USB-to-ethernet converters (`video-converter`), the ATEM Mini Pro (`video-controller`)
and the Panasonic PT-RZ770 (`projector`) are `"video"`, everything else so far is
`"son"` (no lighting equipment in the catalog yet).

A tab's category list is normally *derived* from the devices present, so an empty discipline would
show no category at all. `palette/categories.ts`'s `disciplineCategories` lists categories that exist
up front per discipline (currently Vidéo: `video-source`/`video-converter`/`video-controller`/
`projector` → Sources/Convertisseurs/Contrôleurs/Projecteurs); they're shown even when empty ("Aucun
appareil") and offered in the creation form's category dropdown, followed by any other category
derived from devices. The same file holds `categoryLabel` (id → French heading), shared by the palette
and the form's dropdown.

The creation form (`CreateDeviceForm.tsx`) never asks for a discipline — it isn't a form field at all,
by design. A device's discipline is fixed to whichever tab was active when "+ Nouvel appareil" was
clicked (`Palette.tsx` passes its own `activeDiscipline` state down as a plain, non-editable prop);
editing an existing device passes `editingModel.discipline` instead of the currently-active tab, so
that editing a device from another tab (not something the UI currently allows reaching, but kept
correct regardless) could never silently reassign it. This is also why `existingCategories` (the
category dropdown inside the form) is computed from the *already-discipline-filtered* device list in
`Palette.tsx`, not the full catalog — a category typed while on the Lumière tab only ever autocompletes
against other Lumière categories, never a same-named category that happens to exist under Son.

### Custom node types get no free CSS

React Flow's built-in selection/hover rules only target its own built-in node-type classes
(`.react-flow__node-default` etc.) — a custom node type (`.react-flow__node-device` here) is never
matched by them, regardless of the `--xy-*` variables set. Custom selection/hover rules have to be
written by hand in `theme.css`'s "RÈGLES PERSONNALISÉES" section (and watch for React Flow's own
higher-specificity rules, like `.react-flow__node.selectable:focus { outline: none }`, silently
cancelling a same-specificity custom rule — match the extra class to win).
