# Oak Park Pedestrian Stops

**Dashboard:** https://jvanderberg.github.io/oakpark-pedestrian-stops/

Public dashboard and data repo for Oak Park PD pedestrian stop records.

Pre-2024 records are published with credit to Freedom to Thrive.

- Primary store: `pedestrian-stops.db` (SQLite)
- Main table: `stops`
- Frontend: React + Vite in `dashboard/`

## Data Sources

- Freedom to Thrive Google Sheet (legacy records through 2020): https://docs.google.com/spreadsheets/d/1aFVlaOqM4NeOZuB5DGw9v5xIequI-lY_JmmGN3Jr_UM/edit?gid=23324634#gid=23324634
- Oak Park PD quarterly PDF reports (Q2-Q4 2024) ingested via OCR/extraction tooling in this repo
- Oak Park PD monthly records for 2025 (from existing workbook/database materials in this repo)

## Quick Start

### Dashboard (local)

```bash
cd dashboard
npm install
npm run dev
```

By default Vite runs on `http://localhost:5173` (or the next available port).

### Production build

```bash
cd dashboard
npm run build
npm run preview
```

GitHub Pages deploys automatically from pushes to `main` via `.github/workflows/deploy-pages.yml`.

## Data Layout

SQLite schema (`stops`):

- `id`
- `fc_date`
- `fc_hour`
- `age`
- `sex`
- `ethnic`
- `race_ethnicity_group`
- `juvenile`
- `reason`
- `arrest`
- `cfs_vs_oi`
- `narrative`
- `source_sheet`

The dashboard reads JSON from `dashboard/public/stops.json`.

## 2024 Data Quality Warning

The 2024 source files (Q2-Q4 PDF reports) are low-quality scanned PDFs.

Known ingestion problems from those reports:

- Rows are spread across multiple pages, including page-break splits.
- Some rows are partially visible (half-shown/cut off) at page boundaries.
- Table extraction/OCR misses incomplete rows, so some stops are dropped.
- OCR introduces text errors (especially `reason` and `narrative`) and occasional missing/ambiguous categorical values.

Because of this, 2024 counts should be treated as **best effort**, not exact ground truth.

### Reported vs extracted (Q3/Q4 2024)

Based on the quarterly report totals and current DB extraction:

| Month (2024) | Reported | Extracted | Delta |
|---|---:|---:|---:|
| Jul | 27 | 26 | -1 |
| Aug | 23 | 23 | 0 |
| Sep | 38 | 32 | -6 |
| Oct | 42 | 37 | -5 |
| Nov | 21 | 21 | 0 |
| Dec | 17 | 16 | -1 |

### Manual cleanup applied

To improve consistency after ingest:

- Missing sex values in June 2024 were corrected for known records.
- Unknown/missing race variants were standardized to `Unknown`.
- Reason variants were normalized.
- `TRESPASS` and `TRESPASS WARNING` are intentionally kept as distinct values.
