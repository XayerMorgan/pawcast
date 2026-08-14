/* ==========================================================================
   PawCast JavaScript Application Engine (With High-Contrast Live Radar)
   ========================================================================== */

(function () {
  'use strict';

  const DEFAULT_PET = {
    name: 'Max',
    size: 'medium',
    coat: 'double',
    snout: 'normal',
    age: 'adult'
  };

  const DEFAULT_LOCATION = {
    name: 'New York',
    state: 'New York',
    country: 'United States',
    lat: 40.7128,
    lon: -74.0060
  };

  const DEFAULT_FAVORITES = [
    { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060 },
    { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
    { name: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437 }
  ];

  let appState = {
    location: loadJSON('pawcast_location', DEFAULT_LOCATION),
    units: localStorage.getItem('pawcast_units') || 'imperial',
    source: localStorage.getItem('pawcast_source') || 'openmeteo',
    pet: loadJSON('pawcast_pet', DEFAULT_PET),
    favorites: loadJSON('pawcast_favorites', DEFAULT_FAVORITES),
    weather: null,
    searchDebounce: null,
    
    // Live Radar State
    radarMap: null,
    radarLayers: [],
    radarFrames: [],
    radarCurrentFrameIdx: 0,
    radarAnimTimer: null,
    isRadarPlaying: false
  };

  const el = {
    locationInput: document.getElementById('location-input'),
    searchResults: document.getElementById('search-results'),
    geoBtn: document.getElementById('geo-btn'),
    unitF: document.getElementById('unit-f'),
    unitC: document.getElementById('unit-c'),
    petProfileBtn: document.getElementById('pet-profile-btn'),
    profileBtnLabel: document.getElementById('profile-btn-label'),
    favoriteChips: document.getElementById('favorite-chips'),
    addFavoriteBtn: document.getElementById('add-favorite-btn'),
    activeSourceName: document.getElementById('active-source-name'),
    sourceSelect: document.getElementById('source-select'),

    // Hero Top Cards
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    tempHigh: document.getElementById('temp-high'),
    tempLow: document.getElementById('temp-low'),
    weatherConditionText: document.getElementById('weather-condition-text'),
    weatherMainEmoji: document.getElementById('weather-main-emoji'),

    // Dual Safety Cards
    boxPawSafety: document.getElementById('box-paw-safety'),
    pawStatusTitle: document.getElementById('paw-status-title'),
    asphaltTempVal: document.getElementById('asphalt-temp-val'),
    grassTempVal: document.getElementById('grass-temp-val'),
    pawSafetyDesc: document.getElementById('paw-safety-desc'),

    boxHeatSafety: document.getElementById('box-heat-safety'),
    heatStatusTitle: document.getElementById('heat-status-title'),
    feelsLikeVal: document.getElementById('feels-like-val'),
    humidityVal: document.getElementById('humidity-val'),
    heatSafetyDesc: document.getElementById('heat-safety-desc'),

    walkWindowsGrid: document.getElementById('walk-windows-grid'),

    // Live Radar
    radarMapEl: document.getElementById('radar-map'),
    radarPlayBtn: document.getElementById('radar-play-btn'),
    radarPlayIcon: document.getElementById('radar-play-icon'),
    radarPlayText: document.getElementById('radar-play-text'),
    radarTimestamp: document.getElementById('radar-timestamp'),

    // Hourly & Daily
    hourlySvg: document.getElementById('hourly-svg'),
    hourlyScroller: document.getElementById('hourly-scroller'),
    dailyList: document.getElementById('daily-list'),

    // Weather Metrics Grid
    metricPop: document.getElementById('metric-pop'),
    metricWind: document.getElementById('metric-wind'),
    metricHumidity: document.getElementById('metric-humidity'),
    metricUv: document.getElementById('metric-uv'),
    metricDewpoint: document.getElementById('metric-dewpoint'),
    metricPressure: document.getElementById('metric-pressure'),

    // Simulator
    simAirTemp: document.getElementById('sim-air-temp'),
    simAirVal: document.getElementById('sim-air-val'),
    simSunCondition: document.getElementById('sim-sun-condition'),
    simSurface: document.getElementById('sim-surface'),
    simResultTemp: document.getElementById('sim-result-temp'),
    simRiskBadge: document.getElementById('sim-risk-badge'),
    simTimeLimit: document.getElementById('sim-time-limit'),

    // Pet Modal
    petModal: document.getElementById('pet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    petProfileForm: document.getElementById('pet-profile-form'),
    dogNameInput: document.getElementById('dog-name'),
    dogSizeSelect: document.getElementById('dog-size'),
    dogCoatSelect: document.getElementById('dog-coat'),
    dogSnoutSelect: document.getElementById('dog-snout'),
    dogAgeSelect: document.getElementById('dog-age')
  };

  function init() {
    setupEventListeners();
    updateUIPreferences();
    renderFavoriteChips();
    initLiveRadarMap();
    fetchWeatherData(appState.location);
    initSimulator();
  }

  function setupEventListeners() {
    el.locationInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(appState.searchDebounce);
      if (query.length < 2) {
        el.searchResults.classList.add('hidden');
        return;
      }
      appState.searchDebounce = setTimeout(() => fetchGeocoding(query), 300);
    });

    el.geoBtn.addEventListener('click', getUserGeolocation);
    el.unitF.addEventListener('click', () => setUnits('imperial'));
    el.unitC.addEventListener('click', () => setUnits('metric'));

    el.sourceSelect.value = appState.source;
    el.sourceSelect.addEventListener('change', (e) => {
      appState.source = e.target.value;
      localStorage.setItem('pawcast_source', appState.source);
      fetchWeatherData(appState.location);
    });

    el.addFavoriteBtn.addEventListener('click', addCurrentLocationToFavorites);

    el.petProfileBtn.addEventListener('click', openPetModal);
    el.closeModalBtn.addEventListener('click', closePetModal);
    el.cancelModalBtn.addEventListener('click', closePetModal);
    el.petProfileForm.addEventListener('submit', handleSavePetProfile);

    el.simAirTemp.addEventListener('input', updateSimulator);
    el.simSunCondition.addEventListener('change', updateSimulator);
    el.simSurface.addEventListener('change', updateSimulator);

    el.radarPlayBtn.addEventListener('click', toggleRadarAnimation);

    document.addEventListener('click', (e) => {
      if (!el.locationInput.contains(e.target) && !el.searchResults.contains(e.target)) {
        el.searchResults.classList.add('hidden');
      }
    });
  }

  // --- LIVE HIGH-CONTRAST RADAR MAP ENGINE ---
  function initLiveRadarMap() {
    if (!window.L || !el.radarMapEl) return;

    // Initialize Leaflet map with dark theme CartoDB basemap tiles
    appState.radarMap = L.map(el.radarMapEl, {
      center: [appState.location.lat, appState.location.lon],
      zoom: 7,
      zoomControl: true,
      attributionControl: false
    });

    // Dark Matter CartoDB Basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(appState.radarMap);

    fetchRadarFrames();
  }

  async function fetchRadarFrames() {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) return;
      const data = await res.json();
      
      const frames = [];
      if (data.radar && data.radar.past) {
        data.radar.past.forEach(f => frames.push(f));
      }
      if (data.radar && data.radar.nowcast) {
        data.radar.nowcast.forEach(f => frames.push(f));
      }

      appState.radarFrames = frames;
      if (frames.length > 0) {
        appState.radarCurrentFrameIdx = frames.length - 1;
        showRadarFrame(appState.radarCurrentFrameIdx);
      }
    } catch (e) {
      console.warn('RainViewer Radar API error:', e);
      el.radarTimestamp.textContent = 'Radar Feed Offline';
    }
  }

  function showRadarFrame(index) {
    if (!appState.radarMap || !appState.radarFrames[index]) return;
    const frame = appState.radarFrames[index];

    if (appState.radarLayers[index]) {
      appState.radarLayers.forEach((layer, i) => {
        if (layer) layer.setOpacity(i === index ? 0.85 : 0);
      });
    } else {
      // Color scheme 2 = Vibrant Universal Doppler Colors
      const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      const newLayer = L.tileLayer(tileUrl, {
        opacity: 0.85,
        tileSize: 256
      });
      appState.radarLayers[index] = newLayer;
      newLayer.addTo(appState.radarMap);

      appState.radarLayers.forEach((layer, i) => {
        if (layer && i !== index) layer.setOpacity(0);
      });
    }

    const timeObj = new Date(frame.time * 1000);
    const isForecast = index >= (appState.radarFrames.length - 3);
    const tagPrefix = isForecast ? '🔮 Forecast Radar' : '📡 Live Doppler';
    el.radarTimestamp.textContent = `${tagPrefix}: ${timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  function toggleRadarAnimation() {
    if (appState.isRadarPlaying) {
      stopRadarAnimation();
    } else {
      startRadarAnimation();
    }
  }

  function startRadarAnimation() {
    if (appState.radarFrames.length === 0) return;
    appState.isRadarPlaying = true;
    el.radarPlayIcon.textContent = '⏸';
    el.radarPlayText.textContent = 'Pause Radar';

    appState.radarAnimTimer = setInterval(() => {
      appState.radarCurrentFrameIdx = (appState.radarCurrentFrameIdx + 1) % appState.radarFrames.length;
      showRadarFrame(appState.radarCurrentFrameIdx);
    }, 800);
  }

  function stopRadarAnimation() {
    appState.isRadarPlaying = false;
    clearInterval(appState.radarAnimTimer);
    el.radarPlayIcon.textContent = '▶';
    el.radarPlayText.textContent = 'Play Radar';
  }

  function updateRadarCenter(lat, lon) {
    if (appState.radarMap) {
      appState.radarMap.setView([lat, lon], 8);
    }
  }

  async function fetchWeatherData(loc) {
    el.cityName.textContent = loc.name;
    el.currentDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });

    updateRadarCenter(loc.lat, loc.lon);

    try {
      let data = null;
      if (appState.source === 'nws' && loc.country === 'United States') {
        data = await fetchNWSData(loc.lat, loc.lon);
        el.activeSourceName.textContent = 'RainViewer Radar + NOAA NWS Government';
      }

      if (!data) {
        data = await fetchOpenMeteoData(loc.lat, loc.lon);
        el.activeSourceName.textContent = 'RainViewer Radar + Open-Meteo Global Engine';
      }

      appState.weather = data;
      renderAllWeatherData(data);
    } catch (err) {
      console.error('Weather fetch error:', err);
      el.cityName.textContent = 'Error Loading Weather';
    }
  }

  async function fetchOpenMeteoData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,weather_code,surface_pressure,wind_speed_10m,uv_index,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo failed');
    const raw = await res.json();
    return parseOpenMeteoPayload(raw);
  }

  function parseOpenMeteoPayload(raw) {
    const cur = raw.current;
    const h = raw.hourly;
    const d = raw.daily;

    const hourlyList = [];
    for (let i = 0; i < 24 && i < h.time.length; i++) {
      hourlyList.push({
        time: new Date(h.time[i]),
        tempC: h.temperature_2m[i],
        feelsC: h.apparent_temperature[i],
        humidity: h.relative_humidity_2m[i],
        dewC: h.dew_point_2m[i],
        pop: h.precipitation_probability[i] || 0,
        weatherCode: h.weather_code[i],
        windKmh: h.wind_speed_10m[i],
        uv: h.uv_index[i] || 0,
        isDay: h.is_day ? h.is_day[i] === 1 : (new Date(h.time[i]).getHours() >= 6 && new Date(h.time[i]).getHours() < 20)
      });
    }

    const dailyList = [];
    for (let i = 0; i < d.time.length; i++) {
      dailyList.push({
        date: new Date(d.time[i] + 'T12:00:00'),
        maxTempC: d.temperature_2m_max[i],
        minTempC: d.temperature_2m_min[i],
        weatherCode: d.weather_code[i],
        pop: d.precipitation_probability_max[i] || 0,
        uv: d.uv_index_max[i] || 0
      });
    }

    return {
      current: {
        tempC: cur.temperature_2m,
        feelsC: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        weatherCode: cur.weather_code,
        windKmh: cur.wind_speed_10m,
        windDir: cur.wind_direction_10m,
        pressure: cur.surface_pressure,
        isDay: cur.is_day === 1,
        dewC: h.dew_point_2m[0] || (cur.temperature_2m - ((100 - cur.relative_humidity_2m) / 5)),
        pop: h.precipitation_probability[0] || 0,
        uv: h.uv_index[0] || 0
      },
      hourly: hourlyList,
      daily: dailyList
    };
  }

  async function fetchNWSData(lat, lon) {
    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
        headers: { 'User-Agent': 'PawCastWeatherApp/1.0' }
      });
      if (!pointRes.ok) return null;
      const pointData = await pointRes.json();

      const hRes = await fetch(pointData.properties.forecastHourly, {
        headers: { 'User-Agent': 'PawCastWeatherApp/1.0' }
      });
      if (!hRes.ok) return null;
      const hData = await hRes.json();

      const periods = hData.properties.periods;
      if (!periods || !periods.length) return null;

      const first = periods[0];
      const tempC = (first.temperature - 32) * 5 / 9;

      const hourlyList = periods.slice(0, 24).map(p => {
        const pC = (p.temperature - 32) * 5 / 9;
        return {
          time: new Date(p.startTime),
          tempC: pC,
          feelsC: pC,
          humidity: p.relativeHumidity ? p.relativeHumidity.value : 50,
          dewC: pC - 5,
          pop: p.probabilityOfPrecipitation ? p.probabilityOfPrecipitation.value || 0 : 0,
          weatherCode: nwsConditionToCode(p.shortForecast),
          windKmh: parseWindSpeedKmh(p.windSpeed),
          uv: p.isDaytime ? 4 : 0,
          isDay: p.isDaytime
        };
      });

      return {
        current: {
          tempC: tempC,
          feelsC: tempC,
          humidity: first.relativeHumidity ? first.relativeHumidity.value : 50,
          weatherCode: nwsConditionToCode(first.shortForecast),
          windKmh: parseWindSpeedKmh(first.windSpeed),
          windDir: 180,
          pressure: 1015,
          isDay: first.isDaytime,
          dewC: tempC - 5,
          pop: first.probabilityOfPrecipitation ? first.probabilityOfPrecipitation.value || 0 : 0,
          uv: first.isDaytime ? 4 : 0
        },
        hourly: hourlyList,
        daily: buildDailyFromHourly(hourlyList)
      };
    } catch (e) {
      return null;
    }
  }

  function calculateSurfaceTemps(tempF, isDay = true, uv = 3, windMph = 5) {
    let solarHeatMultiplier = 0.0;

    if (isDay && uv > 0) {
      if (uv <= 2) solarHeatMultiplier = 0.20;
      else if (uv <= 5) solarHeatMultiplier = 0.55;
      else if (uv <= 8) solarHeatMultiplier = 0.85;
      else solarHeatMultiplier = 1.0;
    }

    const maxSolarAdd = 45;
    const windCooling = windMph * 0.2;

    const asphaltAdd = (maxSolarAdd * solarHeatMultiplier) - windCooling;
    const asphaltF = Math.round(tempF + Math.max(0, asphaltAdd));
    const grassF = Math.round(tempF - (isDay ? 2 : 4));

    return {
      asphaltF: Math.max(tempF, asphaltF),
      asphaltC: Math.round((asphaltF - 32) * 5/9),
      grassF: Math.max(40, grassF),
      grassC: Math.round((grassF - 32) * 5/9),
      solarMultiplier: solarHeatMultiplier
    };
  }

  function calculateDualSafetyIndex(tempC, humidity, windKmh, isDay = true, uv = 3) {
    const tempF = (tempC * 9/5) + 32;
    const windMph = windKmh * 0.621371;
    const pet = appState.pet;
    const surfaces = calculateSurfaceTemps(tempF, isDay, uv, windMph);

    let pawStatus = 'green';
    let pawTitle = 'PAWS SAFE ON ALL SIDEWALKS';
    let pawDesc = `Surface is cool (~${surfaces.asphaltF}°F). ${!isDay ? 'Night time cooling has cleared pavement heat.' : 'Sidewalks & pavement are safe for walks.'}`;

    if (surfaces.asphaltF >= 125) {
      pawStatus = 'red';
      pawTitle = 'ASPHALT PAW BURN HAZARD!';
      pawDesc = `Asphalt is ~${surfaces.asphaltF}°F in direct sun! Paw burns can occur in < 60 seconds. Stick strictly to natural grass (~${surfaces.grassF}°F) or use booties.`;
    } else if (surfaces.asphaltF >= 105) {
      pawStatus = 'yellow';
      pawTitle = 'PAW HEAT CAUTION ON BLACKTOP';
      pawDesc = `Asphalt surface is warm (~${surfaces.asphaltF}°F). Prefer grass (~${surfaces.grassF}°F) or shady walkways for ${pet.name}.`;
    }

    if (tempF < 32) {
      if (tempF < 20) {
        pawStatus = 'red';
        pawTitle = 'FREEZING PAW FROSTBITE HAZARD';
        pawDesc = `Freezing ground! High frostbite & salt chemical burn risk. Use protective boots for ${pet.name}.`;
      } else {
        pawStatus = 'yellow';
        pawTitle = 'COLD PAW CAUTION';
        pawDesc = `Chilly surface. Watch out for de-icing salt on sidewalks. Wipe paws after walks.`;
      }
    }

    let heatSensitivityOffset = 0;
    if (pet.snout === 'brachy') heatSensitivityOffset += 5;
    if (pet.coat === 'double' || pet.coat === 'dark') heatSensitivityOffset += 3;
    if (pet.size === 'small') heatSensitivityOffset += 2;

    const heatIndexF = tempF + (humidity > 60 ? (humidity - 60) * 0.15 : 0);
    const adjustedHeatIndex = heatIndexF + heatSensitivityOffset;

    let heatStatus = 'green';
    let heatTitle = 'LOW HEATSTROKE RISK';
    let heatDesc = `Good breathing conditions for ${pet.name}. Maintain normal hydration.`;

    if (adjustedHeatIndex >= 93) {
      heatStatus = 'red';
      heatTitle = 'HIGH HEAT EXHAUSTION DANGER';
      heatDesc = `High ambient heat (${Math.round(tempF)}°F / Feels like ${Math.round(heatIndexF)}°F). Heavy heat stress for ${pet.name} (${capitalize(pet.coat)} coat). Keep walks short and bring water.`;
    } else if (adjustedHeatIndex >= 82) {
      heatStatus = 'yellow';
      heatTitle = 'MODERATE HEAT STRESS CAUTION';
      heatDesc = `Warm weather (${Math.round(tempF)}°F). Take frequent water breaks in shade and avoid vigorous running.`;
    }

    return {
      pawStatus,
      pawTitle,
      pawDesc,
      heatStatus,
      heatTitle,
      heatDesc,
      surfaces,
      tempF,
      feelsF: heatIndexF
    };
  }

  function renderAllWeatherData(data) {
    const isImp = appState.units === 'imperial';
    const cur = data.current;
    const pet = appState.pet;

    const mainTemp = isImp ? Math.round((cur.tempC * 9/5) + 32) : Math.round(cur.tempC);
    const feelsTemp = isImp ? Math.round((cur.feelsC * 9/5) + 32) : Math.round(cur.feelsC);
    const unitSym = isImp ? '°F' : '°C';
    const windSpeedStr = isImp ? `${Math.round(cur.windKmh * 0.621371)} mph` : `${Math.round(cur.windKmh)} km/h`;

    const highC = data.daily[0] ? data.daily[0].maxTempC : cur.tempC + 3;
    const lowC = data.daily[0] ? data.daily[0].minTempC : cur.tempC - 4;
    const highDisp = isImp ? Math.round((highC * 9/5) + 32) : Math.round(highC);
    const lowDisp = isImp ? Math.round((lowC * 9/5) + 32) : Math.round(lowC);

    const condition = getWeatherConditionInfo(cur.weatherCode, cur.isDay);

    el.currentTemp.textContent = `${mainTemp}°`;
    el.tempHigh.textContent = `H: ${highDisp}°`;
    el.tempLow.textContent = `L: ${lowDisp}°`;
    el.weatherConditionText.textContent = condition.label;
    el.weatherMainEmoji.textContent = condition.emoji;

    const safety = calculateDualSafetyIndex(cur.tempC, cur.humidity, cur.windKmh, cur.isDay, cur.uv);

    el.boxPawSafety.className = `safety-card-box status-${safety.pawStatus}`;
    el.pawStatusTitle.textContent = safety.pawTitle;
    el.pawSafetyDesc.textContent = safety.pawDesc;
    el.asphaltTempVal.textContent = isImp ? `${safety.surfaces.asphaltF}°F` : `${safety.surfaces.asphaltC}°C`;
    el.grassTempVal.textContent = isImp ? `${safety.surfaces.grassF}°F` : `${safety.surfaces.grassC}°C`;

    el.boxHeatSafety.className = `safety-card-box status-${safety.heatStatus}`;
    el.heatStatusTitle.textContent = safety.heatTitle;
    el.heatSafetyDesc.textContent = safety.heatDesc;
    el.feelsLikeVal.textContent = `${feelsTemp}${unitSym}`;
    el.humidityVal.textContent = `${cur.humidity}%`;

    el.metricPop.textContent = `${cur.pop}%`;
    el.metricWind.textContent = `${windSpeedStr} ${degToCompass(cur.windDir)}`;
    el.metricHumidity.textContent = `${cur.humidity}%`;
    el.metricUv.textContent = `${cur.uv} (${getUvCategory(cur.uv)})`;
    const dewDisp = isImp ? Math.round((cur.dewC * 9/5) + 32) : Math.round(cur.dewC);
    el.metricDewpoint.textContent = `${dewDisp}${unitSym}`;
    el.metricPressure.textContent = `${Math.round(cur.pressure)} hPa`;

    document.body.className = `theme-${condition.theme}`;

    renderWalkWindows(data.hourly);
    renderHourlyForecast(data.hourly);
    renderDailyForecast(data.daily);

    el.simAirTemp.value = Math.round((cur.tempC * 9/5) + 32);
    updateSimulator();
  }

  function renderHourlyForecast(hourly) {
    const isImp = appState.units === 'imperial';
    el.hourlyScroller.innerHTML = '';

    const temps = hourly.map(h => isImp ? (h.tempC * 9/5) + 32 : h.tempC);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const rangeT = maxT - minT || 1;

    const svg = el.hourlySvg;
    svg.innerHTML = '';
    const width = 1000;
    const height = 180;
    const points = [];

    hourly.forEach((h, i) => {
      const x = (i / (hourly.length - 1)) * (width - 40) + 20;
      const val = isImp ? (h.tempC * 9/5) + 32 : h.tempC;
      const y = height - 30 - ((val - minT) / rangeT) * (height - 60);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      points.push({ x, y, val, pop: h.pop, safety: saf });
    });

    points.forEach(p => {
      if (p.pop > 0) {
        const barH = (p.pop / 100) * 60;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', p.x - 10);
        rect.setAttribute('y', height - 20 - barH);
        rect.setAttribute('width', 20);
        rect.setAttribute('height', barH);
        rect.setAttribute('fill', 'rgba(59, 130, 246, 0.25)');
        rect.setAttribute('rx', 4);
        svg.appendChild(rect);
      }
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      pathD += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#38BDF8');
    path.setAttribute('stroke-width', '3');
    svg.appendChild(path);

    points.forEach((p, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', '5');

      let dotColor = '#10B981';
      if (p.safety.pawStatus === 'yellow' || p.safety.heatStatus === 'yellow') dotColor = '#F59E0B';
      if (p.safety.pawStatus === 'red' || p.safety.heatStatus === 'red') dotColor = '#EF4444';

      circle.setAttribute('fill', dotColor);
      circle.setAttribute('stroke', '#0B0E14');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      if (i % 2 === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', p.x);
        text.setAttribute('y', p.y - 10);
        text.setAttribute('fill', '#F1F5F9');
        text.setAttribute('font-size', '11');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = `${Math.round(p.val)}°`;
        svg.appendChild(text);
      }
    });

    hourly.forEach(h => {
      const tVal = isImp ? Math.round((h.tempC * 9/5) + 32) : Math.round(h.tempC);
      const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const timeStr = h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';

      const card = document.createElement('div');
      card.className = 'hour-card';
      card.innerHTML = `
        <span class="hour-time">${timeStr}</span>
        <span class="hour-emoji">${cond.emoji}</span>
        <span class="hour-temp">${tVal}°</span>
        <span class="hour-paw-badge ${overallStatus}">🐾 ${overallStatus.toUpperCase()}</span>
      `;
      el.hourlyScroller.appendChild(card);
    });
  }

  function renderDailyForecast(daily) {
    const isImp = appState.units === 'imperial';
    el.dailyList.innerHTML = '';

    const allMax = daily.map(d => isImp ? (d.maxTempC * 9/5) + 32 : d.maxTempC);
    const allMin = daily.map(d => isImp ? (d.minTempC * 9/5) + 32 : d.minTempC);
    const minGlobe = Math.min(...allMin);
    const maxGlobe = Math.max(...allMax);
    const globRange = maxGlobe - minGlobe || 1;

    daily.forEach((d, i) => {
      const dayName = i === 0 ? 'Today' : d.date.toLocaleDateString('en-US', { weekday: 'short' });
      const cond = getWeatherConditionInfo(d.weatherCode, true);
      const maxT = isImp ? Math.round((d.maxTempC * 9/5) + 32) : Math.round(d.maxTempC);
      const minT = isImp ? Math.round((d.minTempC * 9/5) + 32) : Math.round(d.minTempC);

      const leftPct = ((minT - minGlobe) / globRange) * 100;
      const widthPct = Math.max(10, ((maxT - minT) / globRange) * 100);

      const saf = calculateDualSafetyIndex(d.maxTempC, 50, 10, true, d.uv);
      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';

      const row = document.createElement('div');
      row.className = 'day-row';
      row.innerHTML = `
        <span class="day-name">${dayName}</span>
        <span class="day-emoji">${cond.emoji}</span>
        <div class="temp-bar-container">
          <span class="day-low-text">${minT}°</span>
          <div class="temp-bar-bg">
            <div class="temp-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
          <span class="day-high-text">${maxT}°</span>
        </div>
        <span class="day-pop">🌧️ ${d.pop}%</span>
        <span class="day-paw-status ${overallStatus}">🐾 ${overallStatus.toUpperCase()}</span>
      `;
      el.dailyList.appendChild(row);
    });
  }

  function renderWalkWindows(hourly) {
    el.walkWindowsGrid.innerHTML = '';
    const windows = [];

    hourly.forEach(h => {
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const isOverallSafe = saf.pawStatus === 'green' && saf.heatStatus === 'green';
      const isGrassOnlySafe = saf.pawStatus === 'yellow' && saf.heatStatus !== 'red';

      if (isOverallSafe) {
        windows.push({
          timeStr: h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          status: 'best',
          label: '🌟 IDEAL WALK'
        });
      } else if (isGrassOnlySafe) {
        windows.push({
          timeStr: h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          status: 'caution',
          label: '🌿 GRASS ONLY'
        });
      }
    });

    const displayWindows = windows.slice(0, 4);

    if (displayWindows.length === 0) {
      el.walkWindowsGrid.innerHTML = `
        <div class="window-card caution" style="grid-column: 1 / -1;">
          <span class="window-time">High Heat Conditions Today</span>
          <span class="window-tag">Walk early before 7 AM or late after 8:30 PM</span>
        </div>
      `;
      return;
    }

    displayWindows.forEach(w => {
      const card = document.createElement('div');
      card.className = `window-card ${w.status}`;
      card.innerHTML = `
        <span class="window-time">${w.timeStr}</span>
        <span class="window-tag">${w.label}</span>
      `;
      el.walkWindowsGrid.appendChild(card);
    });
  }

  function initSimulator() {
    updateSimulator();
  }

  function updateSimulator() {
    const airF = parseInt(el.simAirTemp.value, 10);
    const sunType = el.simSunCondition.value;
    const surfaceType = el.simSurface.value;

    el.simAirVal.textContent = `${airF}°F`;

    let baseAdd = 42;
    if (sunType === 'partial-shade') baseAdd = 20;
    if (sunType === 'full-shade') baseAdd = 0;

    let surfaceMult = 1.0;
    if (surfaceType === 'concrete') surfaceMult = 0.80;
    if (surfaceType === 'sand') surfaceMult = 0.90;
    if (surfaceType === 'grass') surfaceMult = -0.05;

    let resF = Math.round(airF + (baseAdd * surfaceMult));

    el.simResultTemp.textContent = `${resF}°F`;

    if (resF >= 125) {
      el.simRiskBadge.className = 'sim-badge danger';
      el.simRiskBadge.textContent = '🔥 EXTREME PAW BURN HAZARD';
      el.simTimeLimit.innerHTML = 'Burns can occur in <strong>less than 60 seconds</strong> on hot asphalt! Stick strictly to grass.';
    } else if (resF >= 105) {
      el.simRiskBadge.className = 'sim-badge caution';
      el.simRiskBadge.textContent = '⚠️ PAW HEAT CAUTION';
      el.simTimeLimit.innerHTML = 'Pavement is warm. Prefer grass walkways or brief 15-min walks.';
    } else {
      el.simRiskBadge.className = 'sim-badge safe';
      el.simRiskBadge.textContent = '🐾 SAFE GROUND TEMPERATURE';
      el.simTimeLimit.innerHTML = 'Ground is cool & safe for dog paws on all surfaces!';
    }
  }

  async function fetchGeocoding(query) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
      if (!res.ok) return;
      const data = await res.json();
      renderGeocodingResults(data.results || []);
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  }

  function renderGeocodingResults(results) {
    el.searchResults.innerHTML = '';
    if (!results.length) {
      el.searchResults.innerHTML = '<div class="search-result-item">No places found</div>';
      el.searchResults.classList.remove('hidden');
      return;
    }

    results.forEach(loc => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const stateStr = loc.admin1 ? `, ${loc.admin1}` : '';
      item.innerHTML = `
        <span><strong>${loc.name}</strong>${stateStr}</span>
        <span class="country">${loc.country || ''}</span>
      `;
      item.addEventListener('click', () => {
        appState.location = {
          name: loc.name,
          state: loc.admin1 || '',
          country: loc.country || '',
          lat: loc.latitude,
          lon: loc.longitude
        };
        saveJSON('pawcast_location', appState.location);
        el.locationInput.value = '';
        el.searchResults.classList.add('hidden');
        fetchWeatherData(appState.location);
      });
      el.searchResults.appendChild(item);
    });

    el.searchResults.classList.remove('hidden');
  }

  function getUserGeolocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    el.cityName.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        appState.location = {
          name: 'My Location',
          state: '',
          country: 'GPS',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        saveJSON('pawcast_location', appState.location);
        fetchWeatherData(appState.location);
      },
      (err) => {
        alert('Could not retrieve location: ' + err.message);
        fetchWeatherData(appState.location);
      }
    );
  }

  function updateUIPreferences() {
    if (appState.units === 'imperial') {
      el.unitF.classList.add('active');
      el.unitC.classList.remove('active');
    } else {
      el.unitC.classList.add('active');
      el.unitF.classList.remove('active');
    }
    el.profileBtnLabel.textContent = `My Dog: ${appState.pet.name}`;
  }

  function setUnits(unit) {
    appState.units = unit;
    localStorage.setItem('pawcast_units', unit);
    updateUIPreferences();
    if (appState.weather) renderAllWeatherData(appState.weather);
  }

  function openPetModal() {
    const pet = appState.pet;
    el.dogNameInput.value = pet.name;
    el.dogSizeSelect.value = pet.size;
    el.dogCoatSelect.value = pet.coat;
    el.dogSnoutSelect.value = pet.snout;
    el.dogAgeSelect.value = pet.age;
    el.petModal.classList.remove('hidden');
  }

  function closePetModal() {
    el.petModal.classList.add('hidden');
  }

  function handleSavePetProfile(e) {
    e.preventDefault();
    appState.pet = {
      name: el.dogNameInput.value.trim() || 'My Dog',
      size: el.dogSizeSelect.value,
      coat: el.dogCoatSelect.value,
      snout: el.dogSnoutSelect.value,
      age: el.dogAgeSelect.value
    };
    saveJSON('pawcast_pet', appState.pet);
    updateUIPreferences();
    closePetModal();
    if (appState.weather) renderAllWeatherData(appState.weather);
  }

  function renderFavoriteChips() {
    el.favoriteChips.innerHTML = '';
    appState.favorites.forEach((fav, idx) => {
      const chip = document.createElement('div');
      chip.className = `loc-chip ${fav.name === appState.location.name ? 'active' : ''}`;
      chip.innerHTML = `
        <span>${fav.name}</span>
        <span class="chip-remove" data-idx="${idx}">&times;</span>
      `;
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-remove')) {
          e.stopPropagation();
          removeFavorite(idx);
          return;
        }
        appState.location = fav;
        saveJSON('pawcast_favorites', appState.favorites);
        renderFavoriteChips();
        fetchWeatherData(fav);
      });
      el.favoriteChips.appendChild(chip);
    });
  }

  function addCurrentLocationToFavorites() {
    const loc = appState.location;
    if (appState.favorites.some(f => f.name === loc.name)) return;
    appState.favorites.push(loc);
    saveJSON('pawcast_favorites', appState.favorites);
    renderFavoriteChips();
  }

  function removeFavorite(idx) {
    appState.favorites.splice(idx, 1);
    saveJSON('pawcast_favorites', appState.favorites);
    renderFavoriteChips();
  }

  function getWeatherConditionInfo(code, isDay = true) {
    if (code === 0) return { label: 'Clear Sky', emoji: isDay ? '☀️' : '🌙', theme: 'sunny' };
    if (code === 1 || code === 2) return { label: 'Partly Cloudy', emoji: isDay ? '⛅' : '☁️', theme: 'sunny' };
    if (code === 3) return { label: 'Overcast', emoji: '☁️', theme: 'rainy' };
    if (code >= 45 && code <= 48) return { label: 'Foggy', emoji: '🌫️', theme: 'rainy' };
    if (code >= 51 && code <= 67) return { label: 'Rain / Drizzle', emoji: '🌧️', theme: 'rainy' };
    if (code >= 71 && code <= 77) return { label: 'Snow Flurries', emoji: '❄️', theme: 'snowy' };
    if (code >= 80 && code <= 82) return { label: 'Rain Showers', emoji: '🌦️', theme: 'rainy' };
    if (code >= 85 && code <= 86) return { label: 'Snow Showers', emoji: '🌨️', theme: 'snowy' };
    if (code >= 95) return { label: 'Thunderstorm', emoji: '🌩️', theme: 'rainy' };
    return { label: 'Fair Weather', emoji: '🌤️', theme: 'default' };
  }

  function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16] || 'N';
  }

  function getUvCategory(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
  }

  function nwsConditionToCode(desc) {
    if (!desc) return 0;
    const lower = desc.toLowerCase();
    if (lower.includes('thunder')) return 95;
    if (lower.includes('snow')) return 71;
    if (lower.includes('rain') || lower.includes('shower')) return 61;
    if (lower.includes('cloud')) return 2;
    return 0;
  }

  function parseWindSpeedKmh(windStr) {
    if (!windStr) return 10;
    const match = windStr.match(/\d+/);
    const mph = match ? parseInt(match[0], 10) : 6;
    return Math.round(mph * 1.60934);
  }

  function buildDailyFromHourly(hourly) {
    const map = {};
    hourly.forEach(h => {
      const key = h.time.toISOString().split('T')[0];
      if (!map[key]) {
        map[key] = { date: h.time, maxTempC: h.tempC, minTempC: h.tempC, weatherCode: h.weatherCode, pop: h.pop, uv: h.uv };
      } else {
        map[key].maxTempC = Math.max(map[key].maxTempC, h.tempC);
        map[key].minTempC = Math.min(map[key].minTempC, h.tempC);
        map[key].pop = Math.max(map[key].pop, h.pop);
      }
    });
    return Object.values(map).slice(0, 7);
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function loadJSON(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
