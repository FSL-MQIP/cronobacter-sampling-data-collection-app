# Cronobacter Sampling App

A mobile-first Progressive Web App (PWA) for field collection of *Cronobacter* environmental samples. Designed for use on phones without reliable internet — data is saved locally and synced to Google Sheets when online.

**Live app:** https://fsl-mqip.github.io/cronobacter-sampling-data-collection-app/

---

## Features

- **Three sample types:** Soil, Swab, Water — each with type-specific fields
- **Auto-fill:** GPS coordinates, reverse-geocoded location, and ambient weather fetched automatically
- **Voice notes:** Tap the microphone button to dictate notes hands-free
- **Photos:** Attach photos per sample; uploaded to Google Drive on save
- **Offline-first:** All data stored locally (localStorage + IndexedDB); syncs to Google Sheets when back online
- **Email report:** Sends a formatted HTML email with a CSV attachment to the lab
- **CSV download:** Export all session data as a `.csv` file directly from the app

---

## Sample ID Format

```
STATE-INITIALS-NUMBER_SITE_TYPE
```

Example: `NY-KH-1_U_SL` = New York · K. H. · Sample #1 · Urban · Soil

| Code | Meaning |
|------|---------|
| `SL` | Soil |
| `SG` | Swab |
| `W`  | Water |
| `U`  | Urban |
| `R`  | Rural |

---

## Setup

### 1. Deploy the app

The app is a static site — no build step required. Push to any static host (GitHub Pages, Netlify, etc.).

For GitHub Pages: the app is served from the `main` branch root at the URL above.

### 2. Google Apps Script backend

The app sends data to a Google Apps Script web app that handles:
- Logging sample rows to a Google Sheet (`Backup` tab)
- Uploading photos to Google Drive
- Sending email reports via MailApp

**To set up your own GAS backend:**

1. Open the Google Sheet you want data logged to
2. Go to **Extensions → Apps Script**
3. Paste the contents of [`gas/Code.gs`](gas/Code.gs) (see below)
4. Click **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL
6. Paste it into the **GAS Script URL** field in the app's Session Setup (currently hardcoded as a hidden field in `index.html` — update the `value` attribute on the `#gasUrl` input)

**Required GAS authorizations** (grant on first run):
- SpreadsheetApp — logs sample data
- DriveApp — uploads photos
- MailApp — sends email reports

### 3. Session setup

On first open, the app asks for:
- **Collector full name** — used in email reports
- **Initials** — used in sample IDs
- **State** (2-letter code) — used in sample IDs

Lab email, GAS URL, and starting sample numbers are pre-configured as hidden fields in `index.html`.

---

## GAS Script (`gas/Code.gs`)

The Google Apps Script code is not stored in this repo yet. The key functions are:

| Function | Trigger | Action |
|----------|---------|--------|
| `doPost(e)` | Any POST | Routes to handler by `data.action` |
| `handleUpsertRow(data)` | `action: 'upsertRow'` | Inserts or updates a row in the Backup sheet |
| `handlePhotoUpload(data)` | `action: 'uploadPhoto'` | Saves base64 photo to Google Drive |
| `handleSendEmail(data)` | `action: 'sendEmail'` | Sends HTML email with CSV attachment via MailApp |

All responses use `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(ContentService.MimeType.JSON)` to allow CORS from the app.

---

## Architecture

```
index.html          — single-page shell, three views (session / list / form)
css/styles.css      — all styles (fieldbook/earthy theme)
js/
  app.js            — view routing, form logic, main event wiring
  session.js        — session storage and sample counter
  sample-id.js      — sample ID generation
  storage.js        — localStorage CRUD for samples
  backup.js         — GAS sync queue, photo upload to Drive
  export.js         — CSV generation, email send
  geo.js            — GPS + reverse geocoding
  weather.js        — ambient temperature + precipitation fetch
  voice.js          — Web Speech API integration
  photos-db.js      — IndexedDB for local photo storage
  photos-ui.js      — photo capture, thumbnail rendering
sw.js               — service worker (offline caching, cache-first strategy)
manifest.json       — PWA manifest
```

**Data flow:**
1. Form saved → sample written to `localStorage`
2. Photos saved to `IndexedDB`, then uploaded to Google Drive via GAS
3. Sample enqueued for sheet backup → flushed to GAS on next online event
4. Badge switches from **⏳ PENDING** to **✓ RECORDED** after successful sync

---

## Development

```bash
npm install
npm test        # Jest test suite (39 tests)
```

No build step — edit files directly and push. The service worker caches assets under the key `crono-v3`; bump the version in `sw.js` after significant changes to force cache refresh.

---

## Data Fields

| Field | Soil | Swab | Water |
|-------|------|------|-------|
| Date / Time | ✓ | ✓ | ✓ |
| Collector(s) | ✓ | ✓ | ✓ |
| Location (GPS + address) | ✓ | ✓ | ✓ |
| Ambient temp / Precipitation | ✓ | ✓ | ✓ |
| Notes (+ voice input) | ✓ | — | ✓ |
| Surface description (+ voice) | — | ✓ | — |
| Surface type / Cracks / Traffic | — | ✓ | — |
| Water temp | — | — | ✓ |
| Water body description (+ voice) | — | — | ✓ |
| Photos | ✓ | ✓ | ✓ |
