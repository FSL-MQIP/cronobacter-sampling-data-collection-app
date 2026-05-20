# Cronobacter Sampling Field Data App — Design Spec
Date: 2026-05-20
Cornell Food Safety Lab

---

## Overview

A mobile-first progressive web app (PWA) that replaces paper field datasheets for Cronobacter
urban sampling. Collectors use it in the field to record Soil, Swab (Sponge), and Water sample
data. The app auto-populates date/time, GPS coordinates, sampling location name, sample ID,
and weather conditions. Optional voice input handles notes hands-free. Photos are captured
within the app and linked to each sample; they upload automatically to Google Drive when
connected. All data persists offline across multiple days; the collector emails the final CSV
(with photo links) to the lab when done.

---

## Users

- Field sample collectors (non-technical, using a personal smartphone)
- Cornell Food Safety Lab (receives CSV via email)

---

## Core Features

1. **Session setup** — collector enters name and starting sample numbers once; persists across days
2. **Per-sample form** — one form per sample site, type selected each time
3. **Auto-population** — date/time, GPS, location name, sample ID, weather pulled automatically
4. **Voice input** — optional microphone input for notes and surface description fields
5. **Photo capture** — multiple photos per sample, linked to sample ID, uploaded to Google Drive when connected
6. **Offline persistence** — form data in localStorage, photos in IndexedDB; both survive browser close
7. **Silent background backup** — entries auto-appended to Google Sheet, photos auto-uploaded to Google Drive when connected; invisible to collector
8. **Export & send** — download CSV (with photo links) or email to lab at end of trip
9. **Saved entries editable** — collector can tap any saved entry to reopen the form, edit any field, add or remove photos, then re-save

---

## Session Setup

Entered once at the start of a trip. Stored in localStorage and reused across days.

| Field | Source |
|---|---|
| Collector full name | Manual input on first use; remembered and auto-filled on all subsequent sessions |
| Initials | Auto-derived from name (editable) |
| State | Auto-detected from GPS, or manual dropdown fallback |
| Cornell lab email | Pre-filled with `kah357@cornell.edu` (editable, remembered across sessions) |
| GAS Script URL | Manual input (remembered across sessions) — required for background backup |
| Starting sample # — Soil | Manual (default 1; increase if continuing from prior city) |
| Starting sample # — Swab | Manual (default 1) |
| Starting sample # — Water | Manual (default 1) |

---

## Sample ID Format

Format: `STATE-INITIALS-#_SampleType`

| Sample type | Type code | Example |
|---|---|---|
| Soil (urban) | U_SL | NY-YJ-3_U_SL |
| Swab/Sponge (urban) | U_SG | NY-YJ-2_U_SG |
| Water (urban) | U_W | NY-YJ-1_U_W |

Sample numbers auto-increment **independently per type** within a session.
Collector sets the starting number to avoid duplicates when sampling multiple cities in the same state.

---

## Per-Sample Entry Flow

```
Tap "+ New Sample"
        ↓
Select type: [Soil] [Swab] [Water]
        ↓
Form loads:
  - Shared fields auto-populated (date, time, GPS, location, Sample ID, weather)
  - Type-specific fields shown below shared fields
        ↓
Collector confirms/edits fields
        ↓
Collector adds photos ("Add Photo" button; thumbnails shown inline)
        ↓
Tap "Save Sample"
        ↓
Entry appended to session list in localStorage
Photos saved to IndexedDB
Background backup triggered if connected
        ↓
Ready for next sample
```

Saved entries appear in the session list. Tapping any entry reopens it in edit mode — all fields
and photos are editable. Re-saving overwrites the stored entry and re-triggers background backup.

---

## Field Specification

### Shared Fields (all three types)

| Field | Auto-populated from | Input type | Editable |
|---|---|---|---|
| Date (dd/mm/yyyy) | Device clock | Date picker | Yes |
| Time (24h) | Device clock | Time picker | Yes |
| Collector(s) | Session setup | Text | Yes |
| Sampling location | Reverse geocoding from GPS | Text | Yes |
| Sample ID | Auto-generated | Read-only display | No |
| Latitude | Browser Geolocation API | Number | Yes |
| Longitude | Browser Geolocation API | Number | Yes |
| Ambient temperature (°C) | Weather API (Open-Meteo) | Number | Yes |
| Precipitation | Weather API → yes/no | Toggle | Yes |
| Photos | — | Photo capture (see below) | Yes |
| Notes | — | Text + voice mic button | Yes |

### Photo Capture

**Soil and Water:** Free-form capture only. "Add Photo" button opens camera or photo picker.
No suggested labels.

**Swab:** Same free-form capture, plus three suggested label shortcuts:
- "Surface being swabbed"
- "Surrounding environment"
- "Labeled sample bag"

These are shortcuts only — collector can tap them to pre-label a photo, or ignore them and
add photos freely.

**Shared behavior (all types):**
- Multiple photos allowed per sample — no hard limit
- Each photo stored in IndexedDB keyed to the sample ID
- Thumbnail previews shown inline; collector can delete any photo before or after saving
- Photos upload to Google Drive automatically when connected (via GAS script)
- Drive folder structure: `Cronobacter Sampling / STATE_INITIALS_DATE / SAMPLE_ID /`
- CSV `PHOTOS` column contains the Google Drive folder link for that sample

### Soil-Only Fields
No additional fields beyond the shared set.

### Swab-Only Fields

| Field | Input type |
|---|---|
| Environment/surface description + approx. size swabbed | Text area + voice mic button |
| Surface type/material | Dropdown: Metal / Brick / Wood / Concrete / Other |
| → If "Other" selected | Inline text field revealed |
| Cracks/crevices in surface | Yes/No toggle |
| High traffic area | Yes/No toggle |

### Water-Only Fields

| Field | Input type |
|---|---|
| Water temperature (°C, to nearest 0.1°) | Number input |
| Water body depth/size/description | Text area + voice mic button |

---

## Auto-Population Details

### GPS & Location
- `navigator.geolocation.getCurrentPosition()` fires when the form opens
- Coordinates fill Latitude/Longitude fields
- Reverse geocoding via Nominatim (OpenStreetMap, free, no API key) fills Sampling location
- If GPS unavailable: fields left blank with a warning, collector fills manually

### Weather
- Open-Meteo API called with GPS coordinates (free, no API key required)
- Returns current temperature and precipitation status
- Fields pre-filled and editable in case conditions differ from API (e.g., microclimate)
- If offline or API fails: fields left blank, collector fills manually

### Voice Input
- Web Speech API (`SpeechRecognition`) on Notes, surface description, and water body description fields
- Mic button next to the text field; tap to start, tap again to stop
- Transcribed text appended to the field (does not overwrite existing text)
- Graceful fallback: mic button hidden if browser does not support Speech API

---

## Data Persistence (Offline)

- Form data written to `localStorage` immediately on "Save Sample"
- Photos written to `IndexedDB` immediately on capture (localStorage cannot store binary files)
- Session setup persisted in `localStorage`
- App loads and works fully offline after first visit
- All data survives: browser close, phone restart, 2-day gaps between sampling days

---

## Background Backup (Silent)

Every time a sample is saved and the device has connectivity, two things happen silently:

**1. Sheet backup**
- App POSTs the form entry to the Google Apps Script webhook URL from session setup
- Script appends the row to the correct section (SOIL, WATER, or SPONGE) of the lab's Google Sheet
- If offline at save time, queued and retried when signal returns

**2. Photo upload**
- App uploads any photos for that sample to a Google Drive folder via the same GAS script
- Drive folder: `Cronobacter Sampling / STATE_INITIALS_DATE / SAMPLE_ID /`
- Photos too large to send by email (~2–5 MB each) — Drive handles this cleanly
- If offline at save time, photos queued and uploaded when signal returns

No action or notification to the collector — completely transparent.
Purpose: safety net only — lab checks Sheet/Drive only if a collector forgets to send the final email.
**Lab setup required (once):** deploy a Google Apps Script as a web app with Drive and Sheets
permissions; paste the deployment URL into session setup.

---

## Export & Send

### CSV Format

The CSV uses column names that match the lab's existing Urban Samples spreadsheet format.
One row per sample; all sample types share a single file. Type-specific columns are left
blank for rows where they don't apply.

**Columns (in order):**

| Column | Notes |
|---|---|
| SAMPLE-ID | e.g. NY-YJ-3_U_SL |
| DATE | dd/mm/yyyy |
| TIME (24H) | HH:MM |
| COLLECTOR(S) | From session setup, editable |
| LOCATION | From reverse geocoding, editable |
| LATITUDE | Decimal degrees |
| LONGITUDE | Decimal degrees |
| AMBIENT TEMPERATURE (°C) | From Open-Meteo, editable |
| PRECIPITATION | Yes / No |
| NOTES | Soil + Water only; blank for Swab |
| WATER TEMPERATURE (°C) | Water only; blank otherwise |
| WATER BODY DESCRIPTION | Water only; blank otherwise |
| ENVIRONMENT/SURFACE DESCRIPTION | Swab only; blank otherwise |
| SURFACE TYPE | Swab only; blank otherwise |
| SURFACE TYPE (OTHER) | Swab only, if "Other" selected; blank otherwise |
| CRACKS/CREVICES | Swab only; blank otherwise |
| HIGH TRAFFIC AREA | Swab only; blank otherwise |
| PHOTOS | Google Drive folder link; blank if no photos uploaded yet |

Filename: `samples_STATE_INITIALS_DATE.csv`

### Download CSV
- Single "Download CSV" button — available offline
- Generates and downloads the CSV from local data at any point during the trip

### Send to Lab Email
- "Send to Lab" button — disabled if no connectivity
- Uses EmailJS (free tier, client-side, no backend required)
- Attaches CSV file to email (photos are in Drive, not attached — keeps email small)
- Sends to the Cornell lab email entered in session setup
- Primary submission method — intended to be used at end of trip
- Requires internet connection at send time only (not at collection time)

### Clear Session Data
- "Clear Session" button appears after a successful email send
- Before clearing, app verifies that all entries have a confirmed Google Sheets backup (green
  check) — if any entry has not been confirmed, the button is disabled and a warning is shown
- On confirmation, clears all sample entries and photos from localStorage/IndexedDB
- Session setup (name, email, GAS URL) is retained for the next trip
- Counter starting numbers reset to 1 (collector adjusts if continuing to another city)

---

## Technology Stack

| Concern | Choice | Reason |
|---|---|---|
| App framework | Vanilla HTML/CSS/JS | No build step, works offline trivially, no dependencies |
| Form data storage | `localStorage` | Simple key-value, sufficient for ~20 entries per trip |
| Photo storage | `IndexedDB` | Handles binary files; localStorage cannot |
| GPS | Browser Geolocation API | Built-in, no cost |
| Reverse geocoding | Nominatim (OpenStreetMap) | Free, no API key |
| Weather | Open-Meteo | Free, no API key, simple REST |
| Voice | Web Speech API | Built-in Chrome/Safari, no cost |
| Email sending | EmailJS | Free tier (200 emails/month), no backend |
| Background backup | Google Apps Script + Google Sheets + Google Drive | Free, no server, lab controls sheet and Drive folder |
| Hosting | GitHub Pages or Netlify | Free, static hosting |

---

## Permissions Required (from collector)

| Permission | When requested | Required for |
|---|---|---|
| Location | On first form open | GPS auto-fill |
| Microphone | On first mic button tap | Voice notes |
| Camera | On first "Add Photo" tap | Photo capture |

All permissions are optional — app works without them, fields filled manually and photos skipped.

---

## Out of Scope

- Photo editing or annotation within the app
- Real-time monitoring / live dashboard (Google Sheet is backup only, not a live feed)
- Server-side storage or database
- User accounts / authentication
- Simultaneous use by multiple collectors on one device (one device per collector)
- PDF output
- Rural sampling protocols (urban only in this version)
