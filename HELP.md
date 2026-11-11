# PawCast User Guide & Help Manual

Welcome to **PawCast**. This guide explains every control, gauge, forecast panel, and customization option in the station interface.

---

## 1. Finding Locations & Managing Saved Cities

- **Search by City or Postal Code:** Type at least 2 characters into the top search bar (`Search city or postal code...`) and choose a match from the dropdown suggestions.
- **Use Current GPS Location:** Click the compass arrow button inside the right edge of the search bar to query your device's GPS coordinates.
- **Saved Cities Bar:** Below the main header, click **+ Save City** to pin your active location as a quick-access chip. Click any saved city chip to switch immediately, or click `×` on a chip to remove it.

---

## 2. Units & Station Options Drawer

### Temperature & Wind Units
Use the top-right rocker switch to toggle between:
- **`°F / mph`** — Fahrenheit, miles per hour, inches of precipitation, miles of visibility, and inches of mercury (`inHg`).
- **`°C / km/h`** — Celsius, kilometers per hour, millimeters of precipitation, kilometers of visibility, and hectopascals (`hPa`).

### Options Drawer (`⚙️ Options`)
Click **Options** in the header to expand advanced station settings:
- **Weather Data Source:**
  - *Open-Meteo Global Forecast* — Worldwide high-resolution weather, UV, and visibility data.
  - *NOAA National Weather Service (US)* — Official US government hourly forecasts for United States locations, automatically supplemented with Open-Meteo almanac data to guarantee a complete 7-day outlook. (Non-US locations automatically fall back to Open-Meteo.)
- **Auto-Refresh & Manual Sync:** Choose automatic polling every `5`, `10`, `15`, or `30` minutes, or set to `Off (Manual only)`. Click the circular sync icon at any time to refresh weather and radar frames immediately.
- **Ambient Sound (`Weather Audio`):** Toggles procedural Web Audio sound effects—tactile clicks on buttons, radar sonar pings, and live ambient weather soundscapes (rain & wind during precipitation, breeze & songbirds by day, or crickets at night).
- **Official Weather.gov Forecast:** Opens the exact latitude/longitude point forecast on `forecast.weather.gov` in a new tab.

---

## 3. Managing Dog Profiles ("My Dogs")

PawCast tailors heat advisories, daily walk tags, AQI warnings, and pollen reminders to the active dog selected in the **My Dogs** bar.

1. **Quick Switch:** Click any dog chip (for example, `🐾 Max` or `🐾 Bella`) in the **My Dogs** strip to recalculate all walk and allergy guidance immediately.
2. **Add or Edit a Dog:** Click **Dog: [Name]** in the header or **+ Add Dog** in the sub-bar to open the **Manage Dogs & Walk Preferences** dialog.
3. **Profile Attributes & How They Affect Guidance:**
   - **Size & Weight:** Small/toy dogs (`< 20 lbs`) receive slightly earlier thermal caution offsets and cold-weather reminders; large/giant breeds warm up faster during exertion.
   - **Coat Type:** Thick/double coats and black/dark coats add solar/thermal heat-retention offsets (`+3°F` adjusted heat index).
   - **Snout Shape:** Selecting *Flat-Faced / Brachycephalic* (e.g., Bulldogs, Pugs, Frenchies) lowers heat-stress thresholds (`+5°F` heat offset) and tightens poor air quality warnings (`+20` effective AQI sensitivity).
   - **Pollen & Environmental Allergies:** Selecting *Allergy-Sensitive* increases daily and real-time pollen caution sensitivity so paw-wiping and coat-rinsing reminders trigger earlier.
   - **Age Group:** Puppies (`< 1 year`) and Seniors (`7+ years`) receive more conservative heat comfort thresholds (`+2°F` offset).
4. **Export Backup:** Inside the dog profile modal, click **Export Backup** to download a `.json` file (`pawcast_pack_config_YYYY-MM-DD.json`) containing all saved dogs, favorite cities, and station settings.

---

## 4. Reading the Hero Weather & Pavement Panels

### Current Weather Card (Left)
- Displays coordinates, city name, date, current sky condition, ambient temperature, daily high/low, and a clickable **Real-Time Allergy & AQI Bar** at the bottom that scrolls smoothly to the full Air Quality & Allergens section.
- Automatically shifts between daytime and nighttime visual themes based on local solar state.

### Today's Weather Summary (Top Right)
- Summarizes overall outdoor comfort (`COMFORTABLE`, `CRISP / BRISK`, `WARM & HUMID`, `HEAT ADVISORY`, or `FREEZING`) alongside **Feels Like**, **Humidity & Dew Point**, **Wind & Gusts**, **Allergy & Pollen**, **Air Quality (AQI)**, and **Sunrise / Sunset**.

### Dog Walk & Pavement Check (Bottom Right)
Estimates ground surface temperatures using ambient temperature, UV index, daylight, and wind cooling:
- **`< 32°F` (Chilly Ground / Freeze Hazard):** Watch for ice and chemical road salt; consider booties or wiping paws after walks (`< 20°F` triggers a red Freeze Hazard).
- **`32°F – 104°F` (Paws Safe):** Asphalt and grass surfaces are within comfortable walking ranges.
- **`105°F – 124°F` (Warm Pavement — Amber):** Sun-lit blacktop is heating up; prefer grassy strips or shaded sidewalks.
- **`125°F+` (Hot Asphalt — Red):** Direct-sun asphalt can burn paw pads; stick strictly to grass or walk early/late.

> **The 7-Second Rule:** Estimates cannot account for every local road material or shade canopy. Always press the back of your bare hand firmly against sun-exposed pavement for **7 full seconds**—if it is too hot to hold comfortably, it is too hot for your dog's paws.

---

## 5. 7-Day Almanac, Best Walk Hours & 24-Hour Horizon

- **7-Day Weather, Allergy & Walk Forecast:** Shows a rolling 7-day strip starting with `TODAY`. Hover or tap any card for a detailed tooltip breakdown of high/low temps, rain chance, wind, UV, pollen channel scores, and estimated peak pavement temperature.
- **Best Hours Outdoors Today:** Scans the next 24 hours and highlights up to 5 upcoming hourly slots with the safest combination of pavement temperature, heat index, and low rain probability.
- **24-Hour Outlook:** Combines a smooth orange temperature curve, blue precipitation probability bars, and green/amber/red safety dots above an interactive horizontal strip of hourly cards.

---

## 6. Live Doppler Radar

- **Play / Pause Loop:** Click **Play Radar** to animate historical (`Live Radar`) and short-term forecast (`Forecast`) precipitation frames from RainViewer.
- **Pan & Zoom:** Drag to pan and use `+` / `−` to zoom between **Zoom 3** (continental view) and **Zoom 7** (regional storm tracking, maximum native free tile resolution).
- **Rain Intensity Scale:** Color-coded from light rain (cool blue) through moderate/heavy (amber/orange) to severe convection (crimson).

---

## 7. Air Quality, Pollen Spectrum & Allergen Guide

- **4-Channel Pollen & Mold Bars:** Displays `0–10` indices (`LOW`, `MODERATE`, `HIGH`) for **Grass / Turf Pollen**, **Tree Pollen**, **Ragweed & Weeds**, and **Mold & Damp Spores**.
- **EPA Air Quality Strip:** Reports **US EPA AQI** (`0–500`), **PM2.5 Fine** (`µg/m³`), **PM10 Dust** (`µg/m³`), and **Ground-Level Ozone (`O₃`)** (`µg/m³`).
- **Inline `?` Tooltips & Allergen Guide Drawer:**
  - Hover or focus any `?` badge next to a pollen channel or AQI metric for an instant summary tooltip.
  - Click any `?` badge—or click **Allergen Guide** in the panel header—to open the full 8-card reference manual, filterable by *All Definitions*, *Pollens & Mold*, or *Air Quality & Particulates*.

---

## 8. Troubleshooting & Keyboard Shortcuts

- **`Esc` Key:** Closes whichever overlay is open (Dog Profile dialog, Allergen Guide drawer, or Header Options drawer).
- **No Sound When Clicking Toggles:** Ambient sound and hardware clicks default to **Off** to respect browser autoplay policies. Open **Options → Weather Audio: On** to enable sound.
- **GPS Location Fails:** Ensure location permissions are granted in your browser settings and that the page is served via `https://` or `http://localhost` rather than `file://`.
- **Background Tab Countdown:** Auto-refresh uses wall-clock timestamps; if your browser suspends background tabs, PawCast automatically checks elapsed time and refreshes as soon as you return to the tab.
