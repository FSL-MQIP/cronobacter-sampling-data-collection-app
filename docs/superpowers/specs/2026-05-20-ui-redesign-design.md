# UI Redesign — Cronobacter Sampling PWA

**Date:** 2026-05-20  
**Status:** Approved

---

## Summary

Redesign the app's HTML/CSS to fix the "crunched together" feel. No JS logic changes — purely visual/layout work on `index.html` and `css/styles.css`.

**Chosen direction:** Fieldbook / Earthy — warm tones (`#fdf6e3` background, `#5c4033` brown header, `#f5e6c8` text), notebook feel, color-coded sample types.

---

## Design Decisions

| Question | Decision |
|---|---|
| Visual direction | Fieldbook / Earthy (warm browns, cream background) |
| Navigation | Sticky header with back arrow + sample ID |
| Form layout | One scrolling page, fields grouped into labeled section cards |

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| `--brown-dark` | `#5c4033` | Sticky header background, primary action buttons |
| `--cream` | `#f5e6c8` | Header text, primary button text |
| `--cream-bg` | `#fdf6e3` | Page/body background |
| `--cream-field` | `#f9f3e8` | Input field background |
| `--border-warm` | `#d4b896` | Input borders |
| `--text-dark` | `#3e2723` | Primary body text |
| `--text-mid` | `#795548` | Section labels, metadata |
| `--soil-green` | `#8bc34a` | Soil sample accent + New Sample button + Save button |
| `--swab-amber` | `#ff8f00` | Swab sample accent |
| `--water-blue` | `#29b6f6` | Water sample accent |

---

## Architecture

Primary changes:

- **`index.html`** — structural additions (section wrappers, header divs, field-pair divs, `id="list-header-title"` span)
- **`css/styles.css`** — full replacement with the new theme
- **`js/app.js`** — two minimal additions: wire `#btn-back` click, update list header title in `renderSampleList()`

No changes to any other JS module.

---

## Views

### Session Setup

- Sticky brown header: "CRONOBACTER SAMPLING" label + "Session Setup" title
- Fields inside a white rounded card with warm borders
- Submit button: full-width, brown background

### Sample List (`view-list`)

- Sticky brown header showing trip label: e.g. "NY · YJ · May 2026" derived from session state/initials/date
- Full-width green "+ NEW SAMPLE" button at top
- Sample cards with color-coded left border (5px: green/amber/blue by type)
- Per-card backup badge: green "✓ BACKED" or amber "⏳ PENDING"
- Bottom action row: 2-column grid — "⬇ Download CSV" (outlined) + "✉ Send to Lab" (filled brown)
- "Edit Session Setup" as a small text link below the action row
- "Clear Session" danger button hidden until all samples backed up (existing behavior preserved)

### Type Selector (inside `view-form`)

- Three large tap-target buttons (Soil / Swab / Water) with their respective accent colors
- Brown header: "New Sample — Select Type"

### Sample Form (`view-form`)

- Sticky header: sample type label (small, uppercase) + sample ID (bold) + back arrow on left
- Fields grouped into labeled section cards, each card white with warm border and drop shadow:
  1. **📍 LOCATION & TIME** — Date + Time (side by side), Collector(s), Location, Lat + Lon (side by side)
  2. **🌤 CONDITIONS** — Ambient Temp + Precipitation (side by side)
  3. **📝 NOTES** — notes textarea with mic button (hidden for swab type, existing behavior)
  4. **🪨 SURFACE** (swab only) — Surface description, Surface type, Cracks/crevices, High traffic area
  5. **💧 WATER BODY** (water only) — Water temp, Water body description with mic button
  6. **📷 PHOTOS** — swab label buttons + Add Photo button + thumbnail grid
- "SAVE SAMPLE" button: full-width, green (`--soil-green`)
- "Cancel" as a secondary text link below save

---

## Section Card Component

Each section uses the same structure:

```html
<div class="form-section">
  <div class="form-section-label">📍 LOCATION &amp; TIME</div>
  <div class="form-section-body">
    <!-- fields -->
  </div>
</div>
```

CSS:
- `.form-section-label` — 9px, `font-weight:800`, `letter-spacing:1px`, `color: var(--text-mid)`, `margin-bottom:6px`
- `.form-section-body` — white background, `border-radius:8px`, `padding:14px`, `box-shadow:0 1px 3px rgba(0,0,0,0.06)`, `margin-bottom:16px`

---

## Field Pairs (2-column grid)

Date+Time, Lat+Lon, Temp+Precipitation are displayed side by side:

```html
<div class="field-pair">
  <label>…</label>
  <label>…</label>
</div>
```

```css
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
```

---

## Sticky Header

Each view has its own `.view-header` div as the first child:

```html
<div class="view-header">
  <button class="btn-back" id="btn-back">←</button>
  <div class="view-header-text">
    <div class="view-header-sub">SOIL SAMPLE</div>
    <div class="view-header-title">NY-YJ-003_SL</div>
  </div>
</div>
```

```css
.view-header {
  position: sticky;
  top: 0;
  background: var(--brown-dark);
  color: var(--cream);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
  margin: -1rem -1rem 0;  /* bleed to edges */
}
```

The back button calls `showView('view-list')` via a new event listener in `app.js`. For the session setup view and list view, the header has no back button — just the title.

**Note:** This requires a small addition to `app.js` — wiring the `#btn-back` click in `wireFormButtons()`. No other JS changes.

---

## Sample List Header

The list view header in `index.html`:

```html
<div class="view-header">
  <div class="view-header-text">
    <div class="view-header-sub">FIELD LOG</div>
    <div class="view-header-title" id="list-header-title"></div>
  </div>
</div>
```

The session trip label is rendered dynamically. Add to `renderSampleList()` in `app.js`:

```js
const session = getSession();
const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
document.getElementById('list-header-title').textContent = `${session.state} · ${session.initials} · ${month}`;
```

---

## Spacing & Typography

| Property | Value |
|---|---|
| Body padding | `1rem` (unchanged) |
| Label font size | `9px`, `font-weight:800`, `letter-spacing:1px`, `text-transform:uppercase` |
| Input padding | `10px 12px` (up from `0.6rem`) |
| Input background | `var(--cream-field)` |
| Section gap | `16px` between sections |
| Field gap within section | `10px` |
| Button height | `~46px` (min tap target) |

---

## Buttons

| Button | Style |
|---|---|
| Primary (Save, Submit, New Sample) | Full-width, `border-radius:8px`, green or brown fill |
| Secondary (Cancel, Edit Session) | Text link, `color: var(--text-mid)`, no background |
| Download CSV | Outlined — white bg, brown border + text |
| Send to Lab | Filled brown |
| Type selector (Soil/Swab/Water) | Large, `padding:14px`, color-matched accent fill when active |
| Mic button | Small icon button, warm border |
| Photo label buttons | Small, `background: #f5e6c8`, brown text |

---

## Scope

**In scope:**
- `index.html` — structural additions (section wrappers, header divs, field-pair divs, dynamic header span for trip label)
- `css/styles.css` — full rewrite with new theme

**Out of scope (no changes):**
- All JS modules (`app.js`, `session.js`, etc.) — except the two small wiring additions noted above (back button + list header title)
- Service worker, manifest, GAS integration, export logic

---

## Testing

Since this is a visual change, testing is manual:

- [ ] Load app in mobile browser (or DevTools mobile emulation)
- [ ] Session setup view renders with warm theme
- [ ] Sample list shows correct trip label, color-coded cards, action buttons
- [ ] New sample → type selector shows three large buttons
- [ ] Soil form shows Location & Time, Conditions, Notes sections; swab/water-specific sections hidden
- [ ] Swab form shows Surface section; Notes section hidden
- [ ] Water form shows Water Body section
- [ ] Sticky header stays fixed while scrolling a long form
- [ ] Save navigates back to list; list re-renders
- [ ] All existing functional tests still pass (`npm test`)
