# PawCast — Project Facts & Technical Reference

This document records the architecture, data sources, mathematical heuristics, state persistence schema, and design specifications of **PawCast (Engine Rev 5.0)**.

---

## 1. Project Summary

| Property | Value |
| :--- | :--- |
| **Project Name** | PawCast |
| **Engine Revision** | Rev 5.0 |
| **Repository** | `https://github.com/XayerMorgan/pawcast` |
| **Application Type** | Client-side static Single-Page Web Application (zero build dependencies) |
| **Core Stack** | Semantic HTML5 (`index.html`), Custom CSS3 (`styles.css`), Vanilla ES6+ JS (`app.js`) |
| **External Runtime Libraries** | Leaflet `1.9.4` (loaded via Unpkg CDN with SRI integrity hashes) |
| **Default Coordinates** | New York, NY (`40.7128°N, 74.0060°W`) |
| **Default Dog Roster** | `Max` (Medium, Double Coat, Standard Snout, Normal Allergy, Adult) & `Bella` (Small, Short Coat, Brachycephalic, Allergy-Sensitive, Adult) |

---

## 2. File Inventory

| File | Approx. Size | Responsibility |
| :--- | :--- | :--- |
| `index.html` | ~45 KB (849 lines) | Document structure, ARIA roles/landmarks, header & options drawer, 5 instrument rows, 8-card allergen manual, and dog calibration modal |
| `styles.css` | ~49 KB (2,359 lines) | CSS custom properties, anodized slate/amber palette, responsive CSS Grid layouts (`1080px` & `720px` breakpoints), and `prefers-reduced-motion` support |
| `app.js` | ~96 KB (2,411 lines) | IIFE state controller, multi-API telemetry orchestration, pavement/heat/allergy algorithms, dynamic SVG Bezier chart, Leaflet radar loop, and Web Audio synthesizer |
| `pawcast_logo.png` | ~444 KB | Brand emblem and browser favicon |
| `field_station_day.jpg` | ~1.11 MB | Daytime hero weather card background illustration |
| `field_station_night.jpg` | ~893 KB | Nighttime hero weather card background illustration |

---

## 3. External APIs & Endpoints

All endpoints are queried directly from the client over HTTPS without API keys:

1. **Open-Meteo Weather Forecast API**
   - Endpoint: `https://api.open-meteo.com/v1/forecast`
   - Parameters: `current` (`temperature_2m`, `relative_humidity_2m`, `apparent_temperature`, `is_day`, `precipitation`, `weather_code`, `surface_pressure`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`), `hourly` (24-hour rolling slice starting at current local hour), and `daily` (`forecast_days=8` to guarantee a rolling 7-day window across timezones).
2. **NOAA National Weather Service (NWS) API (US Optional Source)**
   - Metadata Endpoint: `https://api.weather.gov/points/{lat},{lon}` (`User-Agent: PawCastFieldStation/5.0`)
   - Hourly Forecast Endpoint: `properties.forecastHourly` (up to 156 hourly periods aggregated into daily highs/lows, supplemented by Open-Meteo sunrise/sunset, visibility, and trailing days if `< 7` days are returned).
3. **Open-Meteo Air Quality & Pollen API (CAMS)**
   - Endpoint: `https://air-quality-api.open-meteo.com/v1/air-quality`
   - Parameters: `us_aqi`, `pm10`, `pm2_5`, `ozone`, `dust`, `grass_pollen`, `birch_pollen`, `ragweed_pollen`, `alder_pollen`, `mugwort_pollen`, `olive_pollen` (`current` + 7-day `hourly` aggregated into daily peak buckets).
4. **Open-Meteo Geocoding API**
   - Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=en&format=json` (debounced at `300ms`).
5. **RainViewer Weather Maps API**
   - Index Endpoint: `https://api.rainviewer.com/public/weather-maps.json`
   - Tile Template: `https://tilecache.rainviewer.com{frame.path}/256/{z}/{x}/{y}/2/1_1.png` (combines `radar.past` and `radar.nowcast` frames; animated at `850ms` per frame; constrained to zoom `3–7`).
6. **Esri ArcGIS Dark Gray Map Tiles**
   - `World_Dark_Gray_Base` & `World_Dark_Gray_Reference` tile servers for high-contrast precipitation visualization.

---

## 4. Core Algorithms & Domain Models

### 4.1 Ground Surface Conductivity & Pavement Model (`calculateSurfaceTemps`)
- **Solar Irradiance Multiplier** (daytime only, `0.0` at night or `UV = 0`):
  - `UV 1–2`: `0.20`
  - `UV 3–5`: `0.55`
  - `UV 6–8`: `0.85`
  - `UV 9+`: `1.00`
- **Estimated Asphalt Temp (`°F`):** `round(tempF + max(0, 45 * solarHeatMultiplier - 0.2 * windMph))` (floored at ambient `tempF`).
- **Estimated Lawn/Grass Temp (`°F`):** `max(35, round(tempF - (isDay ? 2 : 4)))`.
- **Paw Safety Tiers:**
  - `Red (Hot Asphalt)`: `asphaltF >= 125°F`
  - `Yellow (Warm Pavement)`: `105°F <= asphaltF < 125°F`
  - `Green (Paws Safe)`: `32°F <= tempF` and `asphaltF < 105°F`
  - `Yellow (Chilly Ground)`: `20°F <= tempF < 32°F`
  - `Red (Freeze Hazard)`: `tempF < 20°F`

### 4.2 Outdoor Thermal Comfort & Canine Sensitivity (`calculateDualSafetyIndex`)
- **Base Heat Index Approximation:** `heatIndexF = tempF + (humidity > 60 ? (humidity - 60) * 0.15 : 0)`
- **Additive Dog Profile Sensitivity Offsets (`heatSensitivityOffset`):**
  - Brachycephalic (`snout === 'brachy'`): `+5°F`
  - Thick double or dark coat (`coat === 'double' || coat === 'dark'`): `+3°F`
  - Small breed (`size === 'small'`): `+2°F`
  - Puppy or Senior (`age === 'puppy' || age === 'senior'`): `+2°F`
- **Thermal Comfort Tiers:**
  - `Red (Heat Advisory)`: `tempF >= 90°F` or `adjustedHeatIndex >= 94°F`
  - `Yellow (Warm & Humid)`: `tempF >= 80°F` or `adjustedHeatIndex >= 83°F`
  - `Green (Comfortable)`: `48°F <= tempF < 80°F` (and below warm adjusted index)
  - `Green (Crisp / Brisk)`: `32°F <= tempF < 48°F`
  - `Yellow (Freezing)`: `tempF < 32°F`

### 4.3 Aeroallergen & Particulate Bio-Monitor (`computeAeroallergenProfile`)
Computes four normalized `0.2–10.0` channel scores using live CAMS pollen grain counts where available, with hemisphere-adjusted seasonal/meteorological fallback modeling (accounting for rain washout, wind dispersion, humidity, and frost kill):
- **Grass Score:** Live `grass_pollen / 60 * 10` (clamped `0–10`) or seasonal Poaceae curve.
- **Tree Score:** Live `(birch + alder + olive) / 120 * 10` (clamped `0–10`) or spring deciduous/coniferous curve.
- **Weed Score:** Live `(ragweed + mugwort) / 80 * 10` (clamped `0–10`) or late-summer/fall curve with `≤ 32°F` frost suppression.
- **Mold Score:** Meteorological spore model driven by relative humidity (`> 65%` / `> 80%`), active precipitation boost, autumn leaf litter months, and sub-freezing suppression.
- **Channel Tiers:** `Low (< 3.5)`, `Moderate (3.5 – 6.4)`, `High (≥ 6.5)`.
- **Personalized Risk Modifiers:**
  - `allergy === 'sensitive'` adds `+1.5` to real-time effective pollen risk (`+1.0` on 7-day forecast badges).
  - `snout === 'brachy'` adds `+20` to effective AQI risk.

### 4.4 Procedural Web Audio Synthesizer
- **Noise Generator:** 3-second looped brown/pink-weighted noise buffer routed through a `BiquadFilterNode`:
  - *Precipitation (`weatherCode 51–99`):* `bandpass` filter at `950 Hz` (`Q = 0.7`) simulating steady rainfall.
  - *Fair / Cloudy:* `lowpass` filter dynamically modulated by wind speed (`160 + windKmh * 10 Hz`, capped at `600 Hz`).
- **Bio-Acoustic Pulses:** Sine-wave frequency-ramped daytime songbird notes (`2200–3100 Hz` every `3.8s`) and nighttime cricket pulses (`4100 Hz` every `2.4s`), automatically paused when `document.hidden` is true.
- **UI Feedback:** Triangle-wave pitch-drop hardware switch clicks (`440–900 Hz`) and `1320 Hz` sine radar frame pings.

---

## 5. Browser Storage Schema (`localStorage`)

| Key | Type | Description |
| :--- | :--- | :--- |
| `pawcast_location` | JSON Object | Active `{ name, state, country, lat, lon }` |
| `pawcast_favorites` | JSON Array | Saved city waypoint objects |
| `pawcast_dogs` | JSON Array | Saved dog profiles (`{ id, name, size, coat, snout, allergy, age }`); automatically migrates legacy `pawcast_pet` if present |
| `pawcast_active_dog_id` | String | ID of the currently selected dog profile |
| `pawcast_units` | String | `'imperial'` or `'metric'` |
| `pawcast_source` | String | `'openmeteo'` or `'nws'` |
| `pawcast_refresh_interval` | String (Int) | Auto-polling interval in minutes (`'5'`, `'10'`, `'15'`, `'30'`, or `'0'`) |

---

## 6. Design System & Accessibility Notes

- **Color Tokens:**
  - Chassis & Surfaces: `--chassis-bg: #111315`, `--panel-bg: #181B1E`, `--panel-elevated: #1E2226`, `--panel-recessed: #0D0F11`
  - Ink Hierarchy (WCAG 2.2 AA contrast-verified): `--ink-primary: #F2EFE9`, `--ink-secondary: #C4C1B8`, `--ink-muted: #9E9B91`
  - Hardware Signal Accents: `--signal-amber: #E56B25`, `--signal-ochre: #EAB308`, `--signal-sage: #22C55E`, `--signal-crimson: #EF4444`, `--signal-sky: #38BDF8`
- **Typography:**
  - Editorial Display: `Fraunces`
  - UI & Body Copy: `Plus Jakarta Sans`
  - Telemetry & Readouts: `JetBrains Mono`
- **Accessibility Features:**
  - Visible `:focus-visible` amber focus rings (`2px solid #E56B25`), `role="radiogroup"` unit switch, `role="dialog"` modal with `Escape` handling, `aria-expanded` drawers, `aria-live="polite"` network status banner, and `@media (prefers-reduced-motion: reduce)` support.
