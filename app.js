/* ==========================================================================
   PAWCAST // METEOROLOGICAL & CANINE FIELD STATION ENGINE
   Includes:
   - Procedural Web Audio API Weather Soundscape & Tactile Hardware Clicks
   - Thermodynamic Solar Irradiance Ground Conductivity Model
   - Analog Thermal Scale Needle Positioning
   - Live RainViewer Doppler Radar + Timestamp-Based Auto-Polling
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

    // Auto-Polling State
    refreshIntervalMins: parseInt(localStorage.getItem('pawcast_refresh_interval') || '10', 10),
    nextRefreshTimestamp: Date.now() + (10 * 60 * 1000),
    countdownTimer: null,
    isRefreshing: false,

    // Doppler Radar Scope State
    radarMap: null,
    radarLayers: [],
    radarFrames: [],
    radarCurrentFrameIdx: 0,
    radarAnimTimer: null,
    isRadarPlaying: false,

    // Web Audio API Soundscape Engine State
    audioCtx: null,
    isAudioEnabled: false,
    ambientGain: null,
    activeNodes: [],
    birdChirpTimer: null
  };

  const el = {
    locationInput: document.getElementById('location-input'),
    searchResults: document.getElementById('search-results'),
    geoBtn: document.getElementById('geo-btn'),
    unitF: document.getElementById('unit-f'),
    unitC: document.getElementById('unit-c'),
    petProfileBtn: document.getElementById('pet-profile-btn'),
    profileBtnLabel: document.getElementById('profile-btn-label'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundBtnLabel: document.getElementById('sound-btn-label'),
    acousticStatusText: document.getElementById('acoustic-status-text'),

    favoriteChips: document.getElementById('favorite-chips'),
    addFavoriteBtn: document.getElementById('add-favorite-btn'),
    activeSourceName: document.getElementById('active-source-name'),
    sourceSelect: document.getElementById('source-select'),
    nwsGovLink: document.getElementById('nws-gov-link'),

    // Auto-Polling
    autoRefreshSelect: document.getElementById('auto-refresh-select'),
    refreshNowBtn: document.getElementById('refresh-now-btn'),
    refreshCountdown: document.getElementById('refresh-countdown'),

    // Hero Field Station Window
    coordDisplay: document.getElementById('coord-display'),
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    tempHigh: document.getElementById('temp-high'),
    tempLow: document.getElementById('temp-low'),
    weatherConditionText: document.getElementById('weather-condition-text'),
    weatherMainEmoji: document.getElementById('weather-main-emoji'),

    // Dual Precision Gauges
    boxPawSafety: document.getElementById('box-paw-safety'),
    pawStatusPill: document.getElementById('paw-status-pill'),
    pawStatusTitle: document.getElementById('paw-status-title'),
    pawThermalNeedle: document.getElementById('paw-thermal-needle'),
    asphaltTempVal: document.getElementById('asphalt-temp-val'),
    grassTempVal: document.getElementById('grass-temp-val'),
    pawSafetyDesc: document.getElementById('paw-safety-desc'),

    boxHeatSafety: document.getElementById('box-heat-safety'),
    heatStatusPill: document.getElementById('heat-status-pill'),
    heatStatusTitle: document.getElementById('heat-status-title'),
    feelsLikeVal: document.getElementById('feels-like-val'),
    humidityVal: document.getElementById('humidity-val'),
    subjectCoatVal: document.getElementById('subject-coat-val'),
    heatSafetyDesc: document.getElementById('heat-safety-desc'),

    walkWindowsGrid: document.getElementById('walk-windows-grid'),

    // Live Radar Scope
    radarMapEl: document.getElementById('radar-map'),
    radarPlayBtn: document.getElementById('radar-play-btn'),
    radarPlayIcon: document.getElementById('radar-play-icon'),
    radarPlayText: document.getElementById('radar-play-text'),
    radarTimestamp: document.getElementById('radar-timestamp'),

    // Hourly & Daily
    hourlySvg: document.getElementById('hourly-svg'),
    hourlyScroller: document.getElementById('hourly-scroller'),
    dailyList: document.getElementById('daily-list'),

    // Atmospheric Sensor Dials
    metricPop: document.getElementById('metric-pop'),
    barPop: document.getElementById('bar-pop'),
    metricWind: document.getElementById('metric-wind'),
    metricHumidity: document.getElementById('metric-humidity'),
    barHum: document.getElementById('bar-hum'),
    metricUv: document.getElementById('metric-uv'),
    barUv: document.getElementById('bar-uv'),
    metricDewpoint: document.getElementById('metric-dewpoint'),
    metricPressure: document.getElementById('metric-pressure'),

    // Substrate Conductivity Lab
    simAirTemp: document.getElementById('sim-air-temp'),
    simAirVal: document.getElementById('sim-air-val'),
    simSunCondition: document.getElementById('sim-sun-condition'),
    simSurface: document.getElementById('sim-surface'),
    simResultTemp: document.getElementById('sim-result-temp'),
    simRiskBadge: document.getElementById('sim-risk-badge'),
    simTimeLimit: document.getElementById('sim-time-limit'),

    // Calibration Modal
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
    initAutoRefreshSystem();
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

    el.geoBtn.addEventListener('click', () => {
      playHardwareClick(720);
      getUserGeolocation();
    });

    el.unitF.addEventListener('click', () => {
      playHardwareClick(640);
      setUnits('imperial');
    });

    el.unitC.addEventListener('click', () => {
      playHardwareClick(580);
      setUnits('metric');
    });

    if (el.soundToggleBtn) {
      el.soundToggleBtn.addEventListener('click', toggleWeatherAudio);
    }

    el.sourceSelect.value = appState.source;
    el.sourceSelect.addEventListener('change', (e) => {
      playHardwareClick(520);
      appState.source = e.target.value;
      localStorage.setItem('pawcast_source', appState.source);
      fetchWeatherData(appState.location);
    });

    el.addFavoriteBtn.addEventListener('click', () => {
      playHardwareClick(800);
      addCurrentLocationToFavorites();
    });

    el.petProfileBtn.addEventListener('click', () => {
      playHardwareClick(660);
      openPetModal();
    });

    el.closeModalBtn.addEventListener('click', closePetModal);
    el.cancelModalBtn.addEventListener('click', closePetModal);
    el.petProfileForm.addEventListener('submit', handleSavePetProfile);

    el.simAirTemp.addEventListener('input', updateSimulator);
    el.simSunCondition.addEventListener('change', () => {
      playHardwareClick(540);
      updateSimulator();
    });
    el.simSurface.addEventListener('change', () => {
      playHardwareClick(580);
      updateSimulator();
    });

    el.radarPlayBtn.addEventListener('click', () => {
      playHardwareClick(760);
      toggleRadarAnimation();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && appState.refreshIntervalMins > 0) {
        checkAndExecuteAutoRefresh();
      }
    });

    document.addEventListener('click', (e) => {
      if (!el.locationInput.contains(e.target) && !el.searchResults.contains(e.target)) {
        el.searchResults.classList.add('hidden');
      }
    });
  }

  // ==========================================================================
  // PROCEDURAL WEB AUDIO API SOUNDSCAPE & TACTILE HARDWARE FEEDBACK
  // ==========================================================================
  function ensureAudioContext() {
    if (!appState.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        appState.audioCtx = new AudioContextClass();
      }
    }
    if (appState.audioCtx && appState.audioCtx.state === 'suspended') {
      appState.audioCtx.resume();
    }
  }

  function playHardwareClick(freq = 620) {
    if (!appState.isAudioEnabled) return;
    ensureAudioContext();
    const ctx = appState.audioCtx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  function playRadarPing() {
    if (!appState.isAudioEnabled) return;
    ensureAudioContext();
    const ctx = appState.audioCtx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, ctx.currentTime);

    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  function toggleWeatherAudio() {
    ensureAudioContext();
    appState.isAudioEnabled = !appState.isAudioEnabled;

    if (appState.isAudioEnabled) {
      el.soundToggleBtn.classList.add('active');
      el.soundBtnLabel.textContent = 'AUDIO: LIVE';
      playHardwareClick(880);
      syncAmbientSoundscape();
    } else {
      el.soundToggleBtn.classList.remove('active');
      el.soundBtnLabel.textContent = 'AUDIO: OFF';
      stopAmbientSoundscape();
      if (el.acousticStatusText) {
        el.acousticStatusText.textContent = 'Soundscape Muted';
      }
    }
  }

  function stopAmbientSoundscape() {
    if (appState.birdChirpTimer) {
      clearInterval(appState.birdChirpTimer);
      appState.birdChirpTimer = null;
    }
    appState.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) { /* ignore already stopped */ }
    });
    appState.activeNodes = [];
  }

  function syncAmbientSoundscape() {
    if (!appState.isAudioEnabled || !appState.weather) return;
    stopAmbientSoundscape();
    ensureAudioContext();
    const ctx = appState.audioCtx;
    if (!ctx) return;

    const cur = appState.weather.current;
    const code = cur.weatherCode;
    const isDay = cur.isDay;
    const windKmh = cur.windKmh || 8;

    // Create 3 seconds of Pink/Brownian Noise Buffer for natural wind/rain texture
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 2.5;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();

    const isRain = code >= 51 && code <= 99;

    if (isRain) {
      // Rain Patter: Bandpass filtered noise
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.08, ctx.currentTime);
      if (el.acousticStatusText) el.acousticStatusText.textContent = 'Acoustic: Rain Patter & Wind';
    } else {
      // Soft Breeze through trees: Lowpass filtered noise modulated by wind speed
      filter.type = 'lowpass';
      const cutoff = Math.min(600, 160 + windKmh * 10);
      filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.055, ctx.currentTime);
      if (el.acousticStatusText) {
        el.acousticStatusText.textContent = isDay
          ? 'Acoustic: Meadow Breeze & Songbirds'
          : 'Acoustic: Nocturnal Cricket Chorus';
      }
    }

    noiseSource.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);
    noiseSource.start();
    appState.activeNodes.push(noiseSource, filter, masterGain);

    // Add Periodic Bio-Acoustic Touches (Daytime songbird notes or Nighttime crickets)
    if (!isRain) {
      appState.birdChirpTimer = setInterval(() => {
        if (!appState.isAudioEnabled || document.hidden) return;
        if (isDay) {
          triggerSongbirdNote(ctx);
        } else {
          triggerCricketPulse(ctx);
        }
      }, isDay ? 3800 : 2400);
    }
  }

  function triggerSongbirdNote(ctx) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const baseFreq = 2200 + Math.random() * 900;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  function triggerCricketPulse(ctx) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4100, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // ==========================================================================
  // TIMESTAMP-BASED AUTO-POLLING SYSTEM
  // ==========================================================================
  function initAutoRefreshSystem() {
    if (el.autoRefreshSelect) {
      el.autoRefreshSelect.value = appState.refreshIntervalMins.toString();
      el.autoRefreshSelect.addEventListener('change', (e) => {
        playHardwareClick(600);
        appState.refreshIntervalMins = parseInt(e.target.value, 10);
        localStorage.setItem('pawcast_refresh_interval', appState.refreshIntervalMins);
        resetAutoRefreshTimer();
      });
    }

    if (el.refreshNowBtn) {
      el.refreshNowBtn.addEventListener('click', () => {
        playHardwareClick(820);
        triggerRefresh(true);
      });
    }

    resetAutoRefreshTimer();
  }

  function resetAutoRefreshTimer() {
    clearInterval(appState.countdownTimer);
    if (appState.refreshIntervalMins <= 0) {
      if (el.refreshCountdown) el.refreshCountdown.textContent = 'HOLD';
      return;
    }

    appState.nextRefreshTimestamp = Date.now() + (appState.refreshIntervalMins * 60 * 1000);
    updateCountdownUI();

    appState.countdownTimer = setInterval(() => {
      checkAndExecuteAutoRefresh();
    }, 1000);
  }

  function checkAndExecuteAutoRefresh() {
    if (appState.refreshIntervalMins <= 0 || appState.isRefreshing) return;
    const remainingMs = appState.nextRefreshTimestamp - Date.now();
    if (remainingMs <= 0) {
      triggerRefresh(false);
    } else {
      updateCountdownUI();
    }
  }

  function updateCountdownUI() {
    if (!el.refreshCountdown) return;
    if (appState.refreshIntervalMins <= 0) {
      el.refreshCountdown.textContent = 'HOLD';
      return;
    }

    const remainingMs = Math.max(0, appState.nextRefreshTimestamp - Date.now());
    const totalSecs = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const secStr = secs < 10 ? `0${secs}` : `${secs}`;
    el.refreshCountdown.textContent = `T-${mins}:${secStr}`;
  }

  async function triggerRefresh() {
    if (appState.isRefreshing) return;
    appState.isRefreshing = true;

    if (el.refreshNowBtn) {
      el.refreshNowBtn.classList.add('spinning');
      setTimeout(() => el.refreshNowBtn.classList.remove('spinning'), 1200);
    }

    if (el.refreshCountdown) {
      el.refreshCountdown.textContent = 'SYNC...';
    }

    try {
      await fetchWeatherData(appState.location);
      await fetchRadarFrames();
    } catch (e) {
      console.warn('Telemetry refresh error:', e);
    } finally {
      appState.isRefreshing = false;
      resetAutoRefreshTimer();
    }
  }

  // ==========================================================================
  // LIVE DOPPLER RADAR ENGINE (CARTO DARK MATTER + RAINVIEWER)
  // ==========================================================================
  function initLiveRadarMap() {
    if (!window.L || !el.radarMapEl) return;

    appState.radarMap = L.map(el.radarMapEl, {
      center: [appState.location.lat, appState.location.lon],
      zoom: 7,
      zoomControl: true,
      attributionControl: false
    });

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
      el.radarTimestamp.textContent = 'RADAR OFFLINE';
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
    const tagPrefix = isForecast ? 'NOWCAST' : 'DOPPLER';
    el.radarTimestamp.textContent = `${tagPrefix} // ${timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
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
    el.radarPlayText.textContent = 'SWEEP: ACTIVE';

    appState.radarAnimTimer = setInterval(() => {
      appState.radarCurrentFrameIdx = (appState.radarCurrentFrameIdx + 1) % appState.radarFrames.length;
      showRadarFrame(appState.radarCurrentFrameIdx);
      playRadarPing();
    }, 850);
  }

  function stopRadarAnimation() {
    appState.isRadarPlaying = false;
    clearInterval(appState.radarAnimTimer);
    el.radarPlayIcon.textContent = '▶';
    el.radarPlayText.textContent = 'SWEEP: PAUSED';
  }

  function updateRadarCenter(lat, lon) {
    if (appState.radarMap) {
      appState.radarMap.setView([lat, lon], 8);
    }
  }

  // ==========================================================================
  // TELEMETRY ACQUISITION (OPEN-METEO & NOAA NWS)
  // ==========================================================================
  async function fetchWeatherData(loc) {
    el.cityName.textContent = loc.name;
    el.currentDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });

    if (el.coordDisplay) {
      const latDir = loc.lat >= 0 ? 'N' : 'S';
      const lonDir = loc.lon >= 0 ? 'E' : 'W';
      el.coordDisplay.textContent = `${Math.abs(loc.lat).toFixed(2)}°${latDir}, ${Math.abs(loc.lon).toFixed(2)}°${lonDir}`;
    }

    if (el.nwsGovLink) {
      const govUrl = `https://forecast.weather.gov/MapClick.php?lat=${loc.lat.toFixed(4)}&lon=${loc.lon.toFixed(4)}`;
      el.nwsGovLink.href = govUrl;
      el.nwsGovLink.title = `Open official NOAA / NWS government dispatch for ${loc.name} (${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°)`;
    }

    updateRadarCenter(loc.lat, loc.lon);

    try {
      let data = null;
      if (appState.source === 'nws' && loc.country === 'United States') {
        data = await fetchNWSData(loc.lat, loc.lon);
        el.activeSourceName.textContent = 'NOAA NWS + RAINVIEWER';
      }

      if (!data) {
        data = await fetchOpenMeteoData(loc.lat, loc.lon);
        el.activeSourceName.textContent = 'OPEN-METEO WMO + RAINVIEWER';
      }

      appState.weather = data;
      renderAllWeatherData(data);
      if (appState.isAudioEnabled) {
        syncAmbientSoundscape();
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      el.cityName.textContent = 'Telemetry Link Fault';
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
        headers: { 'User-Agent': 'PawCastFieldStation/4.2' }
      });
      if (!pointRes.ok) return null;
      const pointData = await pointRes.json();

      const hRes = await fetch(pointData.properties.forecastHourly, {
        headers: { 'User-Agent': 'PawCastFieldStation/4.2' }
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

  // ==========================================================================
  // THERMODYNAMIC GROUND SURFACE & CANINE RESPIRATORY MODEL
  // ==========================================================================
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
      asphaltC: Math.round((asphaltF - 32) * 5 / 9),
      grassF: Math.max(35, grassF),
      grassC: Math.round((grassF - 32) * 5 / 9),
      solarMultiplier: solarHeatMultiplier
    };
  }

  function calculateDualSafetyIndex(tempC, humidity, windKmh, isDay = true, uv = 3) {
    const tempF = (tempC * 9 / 5) + 32;
    const windMph = windKmh * 0.621371;
    const pet = appState.pet;
    const surfaces = calculateSurfaceTemps(tempF, isDay, uv, windMph);

    let pawStatus = 'green';
    let pawPill = 'NOMINAL';
    let pawTitle = 'SAFE ON ALL SUBSTRATES';
    let pawDesc = `Asphalt is ~${surfaces.asphaltF}°F. ${!isDay ? 'Nocturnal radiative cooling has dissipated solar heat.' : 'Safe conductive contact on sidewalks & turf.'}`;

    if (surfaces.asphaltF >= 125) {
      pawStatus = 'red';
      pawPill = 'HAZARD';
      pawTitle = 'ASPHALT PAW BURN HAZARD';
      pawDesc = `Blacktop is ~${surfaces.asphaltF}°F under solar load! Keratin pad burns occur in <60s. Route strictly over natural turf (~${surfaces.grassF}°F) or fit booties.`;
    } else if (surfaces.asphaltF >= 105) {
      pawStatus = 'yellow';
      pawPill = 'CAUTION';
      pawTitle = 'ELEVATED BLACKTOP HEAT';
      pawDesc = `Asphalt is warm (~${surfaces.asphaltF}°F). Favor shaded walkways or living turf (~${surfaces.grassF}°F) for ${pet.name}.`;
    }

    if (tempF < 32) {
      if (tempF < 20) {
        pawStatus = 'red';
        pawPill = 'FROST HAZARD';
        pawTitle = 'SUB-FREEZING PAD HAZARD';
        pawDesc = `Severe cold & chemical de-icer burn risk. Equip insulated boots for ${pet.name}.`;
      } else {
        pawStatus = 'yellow';
        pawPill = 'COLD CAUTION';
        pawTitle = 'CHILLY SUBSTRATE & SALT';
        pawDesc = `Near-freezing ground. Rinse paw pads after excursion to remove road salt crystals.`;
      }
    }

    let heatSensitivityOffset = 0;
    if (pet.snout === 'brachy') heatSensitivityOffset += 5;
    if (pet.coat === 'double' || pet.coat === 'dark') heatSensitivityOffset += 3;
    if (pet.size === 'small') heatSensitivityOffset += 2;

    const heatIndexF = tempF + (humidity > 60 ? (humidity - 60) * 0.15 : 0);
    const adjustedHeatIndex = heatIndexF + heatSensitivityOffset;

    let heatStatus = 'green';
    let heatPill = 'OPTIMAL';
    let heatTitle = 'LOW RESPIRATORY LOAD';
    let heatDesc = `Efficient evaporative cooling for ${pet.name}. Maintain standard water access.`;

    if (adjustedHeatIndex >= 93) {
      heatStatus = 'red';
      heatPill = 'CRITICAL LOAD';
      heatTitle = 'HIGH HEATSTROKE DANGER';
      heatDesc = `Thermal index ${Math.round(heatIndexF)}°F imposes severe panting strain on ${pet.name} (${capitalize(pet.coat)} coat). Restrict to brief shade relief.`;
    } else if (adjustedHeatIndex >= 82) {
      heatStatus = 'yellow';
      heatPill = 'ELEVATED';
      heatTitle = 'MODERATE THERMAL STRESS';
      heatDesc = `Warm humidity load (${Math.round(tempF)}°F). Schedule water stops and avoid high-exertion sprinting.`;
    }

    return {
      pawStatus,
      pawPill,
      pawTitle,
      pawDesc,
      heatStatus,
      heatPill,
      heatTitle,
      heatDesc,
      surfaces,
      tempF,
      feelsF: heatIndexF
    };
  }

  // ==========================================================================
  // RENDER TELEMETRY TO INSTRUMENT PANELS
  // ==========================================================================
  function renderAllWeatherData(data) {
    const isImp = appState.units === 'imperial';
    const cur = data.current;
    const pet = appState.pet;

    // Toggle Day / Night Field Station Illustration Backdrop
    document.body.classList.toggle('is-night-mode', !cur.isDay);

    const mainTemp = isImp ? Math.round((cur.tempC * 9 / 5) + 32) : Math.round(cur.tempC);
    const feelsTemp = isImp ? Math.round((cur.feelsC * 9 / 5) + 32) : Math.round(cur.feelsC);
    const unitSym = isImp ? '°F' : '°C';
    const windSpeedStr = isImp ? `${Math.round(cur.windKmh * 0.621371)} mph` : `${Math.round(cur.windKmh)} km/h`;

    const highC = data.daily[0] ? data.daily[0].maxTempC : cur.tempC + 3;
    const lowC = data.daily[0] ? data.daily[0].minTempC : cur.tempC - 4;
    const highDisp = isImp ? Math.round((highC * 9 / 5) + 32) : Math.round(highC);
    const lowDisp = isImp ? Math.round((lowC * 9 / 5) + 32) : Math.round(lowC);

    const condition = getWeatherConditionInfo(cur.weatherCode, cur.isDay);

    el.currentTemp.textContent = `${mainTemp}°`;
    el.tempHigh.textContent = `MAX ${highDisp}°`;
    el.tempLow.textContent = `MIN ${lowDisp}°`;
    el.weatherConditionText.textContent = condition.label.toUpperCase();
    el.weatherMainEmoji.textContent = condition.emoji;
    el.weatherMainEmoji.title = `${condition.label}: ${condition.detail}`;

    const safety = calculateDualSafetyIndex(cur.tempC, cur.humidity, cur.windKmh, cur.isDay, cur.uv);

    // Gauge 1: Ground Thermodynamics
    el.boxPawSafety.className = `instrument-gauge status-${safety.pawStatus}`;
    if (el.pawStatusPill) el.pawStatusPill.textContent = safety.pawPill;
    el.pawStatusTitle.textContent = safety.pawTitle;
    el.pawSafetyDesc.textContent = safety.pawDesc;
    el.asphaltTempVal.textContent = isImp ? `${safety.surfaces.asphaltF}°F` : `${safety.surfaces.asphaltC}°C`;
    el.grassTempVal.textContent = isImp ? `${safety.surfaces.grassF}°F` : `${safety.surfaces.grassC}°C`;

    // Position Analog Thermal Needle (maps 25°F .. 145°F -> 4% .. 96%)
    if (el.pawThermalNeedle) {
      const clampedF = Math.max(25, Math.min(145, safety.surfaces.asphaltF));
      const pct = ((clampedF - 25) / (145 - 25)) * 92 + 4;
      el.pawThermalNeedle.style.left = `${pct.toFixed(1)}%`;
    }

    // Gauge 2: Canine Respiratory Load
    el.boxHeatSafety.className = `instrument-gauge status-${safety.heatStatus}`;
    if (el.heatStatusPill) el.heatStatusPill.textContent = safety.heatPill;
    el.heatStatusTitle.textContent = safety.heatTitle;
    el.heatSafetyDesc.textContent = safety.heatDesc;
    el.feelsLikeVal.textContent = `${feelsTemp}${unitSym}`;
    el.humidityVal.textContent = `${cur.humidity}%`;
    if (el.subjectCoatVal) el.subjectCoatVal.textContent = pet.coat.toUpperCase();

    // Atmospheric Sensor Dials
    el.metricPop.textContent = `${cur.pop}%`;
    if (el.barPop) el.barPop.style.width = `${Math.min(100, cur.pop)}%`;
    el.metricWind.textContent = `${windSpeedStr} ${degToCompass(cur.windDir)}`;
    el.metricHumidity.textContent = `${cur.humidity}%`;
    if (el.barHum) el.barHum.style.width = `${Math.min(100, cur.humidity)}%`;
    el.metricUv.textContent = `${cur.uv} (${getUvCategory(cur.uv)})`;
    if (el.barUv) el.barUv.style.width = `${Math.min(100, (cur.uv / 11) * 100)}%`;

    const dewDisp = isImp ? Math.round((cur.dewC * 9 / 5) + 32) : Math.round(cur.dewC);
    el.metricDewpoint.textContent = `${dewDisp}${unitSym}`;
    el.metricPressure.textContent = `${Math.round(cur.pressure)} hPa`;

    renderWalkWindows(data.hourly);
    renderHourlyForecast(data.hourly);
    renderDailyForecast(data.daily);

    el.simAirTemp.value = Math.round((cur.tempC * 9 / 5) + 32);
    updateSimulator();
  }

  function renderHourlyForecast(hourly) {
    const isImp = appState.units === 'imperial';
    el.hourlyScroller.innerHTML = '';

    const temps = hourly.map(h => isImp ? (h.tempC * 9 / 5) + 32 : h.tempC);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const rangeT = maxT - minT || 1;

    const svg = el.hourlySvg;
    svg.innerHTML = '';
    const width = 1000;
    const height = 180;
    const points = [];

    hourly.forEach((h, i) => {
      const x = (i / (hourly.length - 1)) * (width - 44) + 22;
      const val = isImp ? (h.tempC * 9 / 5) + 32 : h.tempC;
      const y = height - 30 - ((val - minT) / rangeT) * (height - 62);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      points.push({ x, y, val, pop: h.pop, safety: saf });
    });

    // Precipitation Probability Bars
    points.forEach(p => {
      if (p.pop > 0) {
        const barH = (p.pop / 100) * 58;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', p.x - 9);
        rect.setAttribute('y', height - 18 - barH);
        rect.setAttribute('width', 18);
        rect.setAttribute('height', barH);
        rect.setAttribute('fill', 'rgba(56, 189, 248, 0.22)');
        rect.setAttribute('rx', 2);

        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        titleEl.textContent = `Precipitation Probability: ${p.pop}%`;
        rect.appendChild(titleEl);
        svg.appendChild(rect);
      }
    });

    // Smooth Cubic Bezier Temperature Curve
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
    path.setAttribute('stroke', '#E56B25');
    path.setAttribute('stroke-width', '2.5');
    svg.appendChild(path);

    points.forEach((p, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', '4.5');

      let dotColor = '#22C55E';
      if (p.safety.pawStatus === 'yellow' || p.safety.heatStatus === 'yellow') dotColor = '#EAB308';
      if (p.safety.pawStatus === 'red' || p.safety.heatStatus === 'red') dotColor = '#EF4444';

      circle.setAttribute('fill', dotColor);
      circle.setAttribute('stroke', '#0D0F11');
      circle.setAttribute('stroke-width', '2');

      const circleTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      circleTitle.textContent = `${Math.round(p.val)}° // ${p.safety.pawTitle} (Asphalt: ${p.safety.surfaces.asphaltF}°F, Turf: ${p.safety.surfaces.grassF}°F)`;
      circle.appendChild(circleTitle);
      svg.appendChild(circle);

      if (i % 2 === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', p.x);
        text.setAttribute('y', p.y - 10);
        text.setAttribute('fill', '#F2EFE9');
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.setAttribute('font-size', '10.5');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = `${Math.round(p.val)}°`;
        svg.appendChild(text);
      }
    });

    // Tactile Hourly Cards with Hover Symbol Breakdown
    hourly.forEach(h => {
      const tVal = isImp ? Math.round((h.tempC * 9 / 5) + 32) : Math.round(h.tempC);
      const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const timeStr = h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';

      const statusLabel = overallStatus === 'green' ? 'SAFE' : overallStatus === 'yellow' ? 'CAUT' : 'HZRD';

      let pawToolTipMeaning = '';
      if (overallStatus === 'green') {
        pawToolTipMeaning = `NOMINAL SAFE: Asphalt ~${saf.surfaces.asphaltF}°F. Safe for extended walks on all surfaces.`;
      } else if (overallStatus === 'yellow') {
        pawToolTipMeaning = `CAUTION: Asphalt warm (~${saf.surfaces.asphaltF}°F). Prefer natural turf (~${saf.surfaces.grassF}°F).`;
      } else {
        pawToolTipMeaning = `HAZARD: Critical asphalt heat (~${saf.surfaces.asphaltF}°F) or respiratory load!`;
      }

      const card = document.createElement('div');
      card.className = 'hour-card';
      card.title = `${timeStr} // ${cond.label}\nTemp: ${tVal}° | Precip: ${h.pop}% | UV: ${h.uv}\n${pawToolTipMeaning}`;

      card.innerHTML = `
        <span class="hour-time">${timeStr}</span>
        <span class="hour-emoji" title="${cond.label}: ${cond.detail}">${cond.emoji}</span>
        <span class="hour-temp" title="Ambient Air: ${tVal}°">${tVal}°</span>
        <span class="hour-paw-badge ${overallStatus}" title="${pawToolTipMeaning}">${statusLabel}</span>
      `;
      el.hourlyScroller.appendChild(card);
    });
  }

  function renderDailyForecast(daily) {
    const isImp = appState.units === 'imperial';
    el.dailyList.innerHTML = '';

    const allMax = daily.map(d => isImp ? (d.maxTempC * 9 / 5) + 32 : d.maxTempC);
    const allMin = daily.map(d => isImp ? (d.minTempC * 9 / 5) + 32 : d.minTempC);
    const minGlobe = Math.min(...allMin);
    const maxGlobe = Math.max(...allMax);
    const globRange = maxGlobe - minGlobe || 1;

    daily.forEach((d, i) => {
      const dayName = i === 0 ? 'TODAY' : d.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const cond = getWeatherConditionInfo(d.weatherCode, true);
      const maxT = isImp ? Math.round((d.maxTempC * 9 / 5) + 32) : Math.round(d.maxTempC);
      const minT = isImp ? Math.round((d.minTempC * 9 / 5) + 32) : Math.round(d.minTempC);

      const leftPct = ((minT - minGlobe) / globRange) * 100;
      const widthPct = Math.max(10, ((maxT - minT) / globRange) * 100);

      const saf = calculateDualSafetyIndex(d.maxTempC, 50, 10, true, d.uv);
      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';
      const statusText = overallStatus === 'green' ? 'NOMINAL' : overallStatus === 'yellow' ? 'CAUTION' : 'HAZARD';

      const row = document.createElement('div');
      row.className = 'day-row';
      row.title = `${dayName}: ${cond.label}. Max: ${maxT}°, Min: ${minT}°. Precip: ${d.pop}%. Peak Status: ${statusText}`;
      row.innerHTML = `
        <span class="day-name">${dayName}</span>
        <span class="day-emoji" title="${cond.label}: ${cond.detail}">${cond.emoji}</span>
        <div class="temp-bar-container">
          <span class="day-low-text">${minT}°</span>
          <div class="temp-bar-bg">
            <div class="temp-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
          <span class="day-high-text">${maxT}°</span>
        </div>
        <span class="day-pop" title="Precipitation Probability: ${d.pop}%">${d.pop}%</span>
        <span class="day-paw-status ${overallStatus}" title="Peak Daytime Canine Status: ${statusText}">${statusText}</span>
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
          label: 'ALL SURFACES CLEAR'
        });
      } else if (isGrassOnlySafe) {
        windows.push({
          timeStr: h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          status: 'caution',
          label: 'TURF / SHADE ONLY'
        });
      }
    });

    const displayWindows = windows.slice(0, 5);

    if (displayWindows.length === 0) {
      el.walkWindowsGrid.innerHTML = `
        <div class="window-card caution">
          <span class="window-time">THERMAL ADVISORY</span>
          <span class="window-tag">Restrict excursions to pre-dawn or post-sunset hours</span>
        </div>
      `;
      return;
    }

    displayWindows.forEach(w => {
      const card = document.createElement('div');
      card.className = `window-card ${w.status}`;
      card.title = `Recommended Excursion Slot: ${w.timeStr} (${w.label})`;
      card.innerHTML = `
        <span class="window-time">${w.timeStr}</span>
        <span class="window-tag">${w.label}</span>
      `;
      el.walkWindowsGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // SUBSTRATE CONDUCTIVITY LAB SIMULATOR
  // ==========================================================================
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
    if (surfaceType === 'concrete') surfaceMult = 0.78;
    if (surfaceType === 'sand') surfaceMult = 0.90;
    if (surfaceType === 'grass') surfaceMult = -0.06;

    const resF = Math.round(airF + (baseAdd * surfaceMult));
    el.simResultTemp.textContent = `${resF}°F`;

    if (resF >= 125) {
      el.simRiskBadge.className = 'chamber-verdict danger';
      el.simRiskBadge.textContent = 'CRITICAL PAW BURN HAZARD';
      el.simTimeLimit.innerHTML = 'Epidermal pad blistering can occur in <strong>under 60 seconds</strong>. Reroute onto natural turf.';
    } else if (resF >= 105) {
      el.simRiskBadge.className = 'chamber-verdict caution';
      el.simRiskBadge.textContent = 'ELEVATED CONDUCTIVE HEAT';
      el.simTimeLimit.innerHTML = 'Substrate is uncomfortable for prolonged standing. Limit contact to 10–15 minutes.';
    } else {
      el.simRiskBadge.className = 'chamber-verdict safe';
      el.simRiskBadge.textContent = 'NOMINAL SUBSTRATE TEMP';
      el.simTimeLimit.innerHTML = 'Safe thermal equilibrium for canine paw pads across extended excursions.';
    }
  }

  // ==========================================================================
  // GEOCODING, GPS, UNITS & SUBJECT PROFILE CALIBRATION
  // ==========================================================================
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
      el.searchResults.innerHTML = '<div class="search-result-item">No matching sector coordinates</div>';
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
        playHardwareClick(740);
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
      alert('Geolocation telemetry is not supported by this browser.');
      return;
    }
    el.cityName.textContent = 'Acquiring GPS...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        appState.location = {
          name: 'Local GPS Sector',
          state: '',
          country: 'GPS',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        saveJSON('pawcast_location', appState.location);
        fetchWeatherData(appState.location);
      },
      (err) => {
        alert('Could not acquire GPS lock: ' + err.message);
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
    el.profileBtnLabel.textContent = `SUBJECT: ${appState.pet.name.toUpperCase()}`;
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
    playHardwareClick(860);
    appState.pet = {
      name: el.dogNameInput.value.trim() || 'Max',
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
        <span>${fav.name.toUpperCase()}</span>
        <span class="chip-remove" data-idx="${idx}">&times;</span>
      `;
      chip.addEventListener('click', (e) => {
        playHardwareClick(680);
        if (e.target.classList.contains('chip-remove')) {
          e.stopPropagation();
          removeFavorite(idx);
          return;
        }
        appState.location = fav;
        saveJSON('pawcast_location', fav);
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
    if (code === 0) return { label: 'Clear Sky', emoji: isDay ? '☀️' : '🌙', detail: 'Unobstructed shortwave solar load in daylight', theme: 'sunny' };
    if (code === 1 || code === 2) return { label: 'Scattered Clouds', emoji: isDay ? '⛅' : '☁️', detail: 'Intermittent solar radiation & broken cloud deck', theme: 'sunny' };
    if (code === 3) return { label: 'Overcast Deck', emoji: '☁️', detail: 'Diffused sky radiation & full cloud canopy', theme: 'rainy' };
    if (code >= 45 && code <= 48) return { label: 'Radiation Fog', emoji: '🌫️', detail: 'Saturated boundary layer & low visibility', theme: 'rainy' };
    if (code >= 51 && code <= 67) return { label: 'Precipitation', emoji: '🌧️', detail: 'Wet conductive substrate & hydro-cooling', theme: 'rainy' };
    if (code >= 71 && code <= 77) return { label: 'Snowfall', emoji: '❄️', detail: 'Frozen substrate & road de-icer hazard', theme: 'snowy' };
    if (code >= 80 && code <= 82) return { label: 'Convective Showers', emoji: '🌦️', detail: 'Passing rain bands', theme: 'rainy' };
    if (code >= 85 && code <= 86) return { label: 'Snow Squalls', emoji: '🌨️', detail: 'Heavy frozen accumulation', theme: 'snowy' };
    if (code >= 95) return { label: 'Electrical Storm', emoji: '🌩️', detail: 'Lightning hazard & acoustic startle trigger for canines', theme: 'rainy' };
    return { label: 'Fair Conditions', emoji: '🌤️', detail: 'Nominal atmospheric state', theme: 'default' };
  }

  function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16] || 'N';
  }

  function getUvCategory(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Mod';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'V.High';
    return 'Extrm';
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
