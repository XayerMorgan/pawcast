/* ==========================================================================
   PAWCAST // METEOROLOGICAL & CANINE FIELD STATION ENGINE (REV 5.0)
   Includes:
   - Multi-Dog Pack Roster & Persistent Configuration Storage + JSON Export
   - Top 7-Day Weekly Almanac & Canine Safety Outlook Ribbon
   - Instrument 05: Aeroallergen, Pollen Spectrum & US EPA AQI Bio-Monitor
   - Procedural Web Audio API Weather Soundscape & Tactile Hardware Clicks
   - Thermodynamic Solar Irradiance Ground Conductivity Model
   - Live RainViewer Doppler Radar (Zoom 3-7) + Timestamp-Based Auto-Polling
   ========================================================================== */

(function () {
  'use strict';

  const DEFAULT_DOGS = [
    {
      id: 'dog_max',
      name: 'Max',
      size: 'medium',
      coat: 'double',
      snout: 'normal',
      allergy: 'normal',
      age: 'adult'
    },
    {
      id: 'dog_bella',
      name: 'Bella',
      size: 'small',
      coat: 'short',
      snout: 'brachy',
      allergy: 'sensitive',
      age: 'adult'
    }
  ];

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

  // Migrate legacy single pet if present
  function initDogsPack() {
    const savedPack = loadJSON('pawcast_dogs', null);
    if (Array.isArray(savedPack) && savedPack.length > 0) {
      return savedPack;
    }
    const legacySingle = loadJSON('pawcast_pet', null);
    if (legacySingle && legacySingle.name) {
      const migrated = [
        {
          id: 'dog_' + Date.now(),
          name: legacySingle.name,
          size: legacySingle.size || 'medium',
          coat: legacySingle.coat || 'double',
          snout: legacySingle.snout || 'normal',
          allergy: legacySingle.allergy || 'normal',
          age: legacySingle.age || 'adult'
        }
      ];
      saveJSON('pawcast_dogs', migrated);
      return migrated;
    }
    saveJSON('pawcast_dogs', DEFAULT_DOGS);
    return DEFAULT_DOGS;
  }

  const initialDogs = initDogsPack();
  const initialActiveId = localStorage.getItem('pawcast_active_dog_id') || initialDogs[0].id;

  let appState = {
    location: loadJSON('pawcast_location', DEFAULT_LOCATION),
    units: localStorage.getItem('pawcast_units') || 'imperial',
    source: localStorage.getItem('pawcast_source') || 'openmeteo',
    dogs: initialDogs,
    activeDogId: initialDogs.some(d => d.id === initialActiveId) ? initialActiveId : initialDogs[0].id,
    favorites: loadJSON('pawcast_favorites', DEFAULT_FAVORITES),
    weather: null,
    airQuality: null,
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

  function getActiveDog() {
    return appState.dogs.find(d => d.id === appState.activeDogId) || appState.dogs[0];
  }

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

    // Multi-Dog Pack Roster Bar
    dogRosterChips: document.getElementById('dog-roster-chips'),
    addDogQuickBtn: document.getElementById('add-dog-quick-btn'),
    weeklyPackTag: document.getElementById('weekly-pack-tag'),

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
    heroWindVal: document.getElementById('hero-wind-val'),
    heroSunVal: document.getElementById('hero-sun-val'),
    heroVisVal: document.getElementById('hero-vis-val'),
    heroMoonVal: document.getElementById('hero-moon-val'),
    subjectCoatVal: document.getElementById('subject-coat-val'),
    heatSafetyDesc: document.getElementById('heat-safety-desc'),

    // Top 7-Day Weekly Forecast Grid & Walk Windows
    dailyList: document.getElementById('daily-list'),
    walkWindowsGrid: document.getElementById('walk-windows-grid'),

    // Live Radar Scope
    radarMapEl: document.getElementById('radar-map'),
    radarPlayBtn: document.getElementById('radar-play-btn'),
    radarPlayIcon: document.getElementById('radar-play-icon'),
    radarPlayText: document.getElementById('radar-play-text'),
    radarTimestamp: document.getElementById('radar-timestamp'),

    // Hourly Horizon
    hourlySvg: document.getElementById('hourly-svg'),
    hourlyScroller: document.getElementById('hourly-scroller'),

    // Aeroallergen & Air Quality Bio-Monitor
    aqiBadge: document.getElementById('aqi-badge'),
    allergyOverallBadge: document.getElementById('allergy-overall-badge'),
    pollenGrassVal: document.getElementById('pollen-grass-val'),
    pollenGrassBar: document.getElementById('pollen-grass-bar'),
    pollenTreeVal: document.getElementById('pollen-tree-val'),
    pollenTreeBar: document.getElementById('pollen-tree-bar'),
    pollenWeedVal: document.getElementById('pollen-weed-val'),
    pollenWeedBar: document.getElementById('pollen-weed-bar'),
    pollenMoldVal: document.getElementById('pollen-mold-val'),
    pollenMoldBar: document.getElementById('pollen-mold-bar'),
    allergyProtocolCard: document.getElementById('allergy-protocol-card'),
    aqiNumVal: document.getElementById('aqi-num-val'),
    pm25Val: document.getElementById('pm25-val'),
    pm10Val: document.getElementById('pm10-val'),
    ozoneVal: document.getElementById('ozone-val'),
    allergyVerdictTitle: document.getElementById('allergy-verdict-title'),
    allergyVerdictDesc: document.getElementById('allergy-verdict-desc'),
    symptomWatchRow: document.getElementById('symptom-watch-row'),
    allergenHelpToggleBtn: document.getElementById('allergen-help-toggle-btn'),
    allergenHelpBtnText: document.getElementById('allergen-help-btn-text'),
    allergenHelpDrawer: document.getElementById('allergen-help-drawer'),
    closeAllergenHelpBtn: document.getElementById('close-allergen-help-btn'),

    // Atmospheric Sensor Dials
    metricPop: document.getElementById('metric-pop'),
    barPop: document.getElementById('bar-pop'),
    metricPrecipSub: document.getElementById('metric-precip-sub'),
    metricWind: document.getElementById('metric-wind'),
    metricGustSub: document.getElementById('metric-gust-sub'),
    metricHumidity: document.getElementById('metric-humidity'),
    barHum: document.getElementById('bar-hum'),
    metricHumSub: document.getElementById('metric-hum-sub'),
    metricUv: document.getElementById('metric-uv'),
    barUv: document.getElementById('bar-uv'),
    metricUvSub: document.getElementById('metric-uv-sub'),
    metricDewpoint: document.getElementById('metric-dewpoint'),
    metricVisSub: document.getElementById('metric-vis-sub'),
    metricPressure: document.getElementById('metric-pressure'),
    metricBaroSub: document.getElementById('metric-baro-sub'),
    baroUnitLabel: document.getElementById('baro-unit-label'),

    // Multi-Dog Calibration Modal
    petModal: document.getElementById('pet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    modalDogList: document.getElementById('modal-dog-list'),
    newDogModalBtn: document.getElementById('new-dog-modal-btn'),
    deleteDogBtn: document.getElementById('delete-dog-btn'),
    exportConfigBtn: document.getElementById('export-config-btn'),
    petProfileForm: document.getElementById('pet-profile-form'),
    dogIdInput: document.getElementById('dog-id'),
    dogNameInput: document.getElementById('dog-name'),
    dogSizeSelect: document.getElementById('dog-size'),
    dogCoatSelect: document.getElementById('dog-coat'),
    dogSnoutSelect: document.getElementById('dog-snout'),
    dogAllergySelect: document.getElementById('dog-allergy'),
    dogAgeSelect: document.getElementById('dog-age')
  };

  function init() {
    setupEventListeners();
    updateUIPreferences();
    renderDogRosterChips();
    renderFavoriteChips();
    initLiveRadarMap();
    initAutoRefreshSystem();
    fetchWeatherData(appState.location);
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

    // Multi-Dog Pack Listeners
    el.petProfileBtn.addEventListener('click', () => {
      playHardwareClick(660);
      openPetModal(appState.activeDogId);
    });

    if (el.addDogQuickBtn) {
      el.addDogQuickBtn.addEventListener('click', () => {
        playHardwareClick(780);
        openPetModal('NEW');
      });
    }

    if (el.newDogModalBtn) {
      el.newDogModalBtn.addEventListener('click', () => {
        playHardwareClick(780);
        populateFormForNewDog();
      });
    }

    if (el.deleteDogBtn) {
      el.deleteDogBtn.addEventListener('click', handleDeleteDog);
    }

    if (el.exportConfigBtn) {
      el.exportConfigBtn.addEventListener('click', handleExportConfiguration);
    }

    el.closeModalBtn.addEventListener('click', closePetModal);
    el.cancelModalBtn.addEventListener('click', closePetModal);
    el.petProfileForm.addEventListener('submit', handleSavePetProfile);

    // Allergen & Particulate Help System Listeners
    if (el.allergenHelpToggleBtn) {
      el.allergenHelpToggleBtn.addEventListener('click', () => {
        playHardwareClick(680);
        toggleAllergenHelpDrawer();
      });
    }

    if (el.closeAllergenHelpBtn) {
      el.closeAllergenHelpBtn.addEventListener('click', () => {
        playHardwareClick(560);
        toggleAllergenHelpDrawer(false);
      });
    }

    document.querySelectorAll('.inline-help-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playHardwareClick(740);
        const targetKey = btn.dataset.helpTarget;
        openAndSpotlightAllergenDef(targetKey);
      });
    });

    document.querySelectorAll('.help-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        playHardwareClick(640);
        filterAllergenDefinitions(tab.dataset.helpFilter);
      });
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

  function toggleAllergenHelpDrawer(forceOpen) {
    if (!el.allergenHelpDrawer) return;
    const isCurrentlyHidden = el.allergenHelpDrawer.classList.contains('hidden');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyHidden;

    if (shouldOpen) {
      el.allergenHelpDrawer.classList.remove('hidden');
      el.allergenHelpDrawer.setAttribute('aria-hidden', 'false');
      if (el.allergenHelpToggleBtn) {
        el.allergenHelpToggleBtn.classList.add('active');
        el.allergenHelpToggleBtn.setAttribute('aria-expanded', 'true');
      }
      if (el.allergenHelpBtnText) {
        el.allergenHelpBtnText.textContent = 'HIDE GUIDE';
      }
    } else {
      el.allergenHelpDrawer.classList.add('hidden');
      el.allergenHelpDrawer.setAttribute('aria-hidden', 'true');
      if (el.allergenHelpToggleBtn) {
        el.allergenHelpToggleBtn.classList.remove('active');
        el.allergenHelpToggleBtn.setAttribute('aria-expanded', 'false');
      }
      if (el.allergenHelpBtnText) {
        el.allergenHelpBtnText.textContent = 'ALLERGEN GUIDE';
      }
      document.querySelectorAll('.allergen-def-card').forEach(c => c.classList.remove('spotlight-card'));
    }
  }

  function filterAllergenDefinitions(category) {
    document.querySelectorAll('.help-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.helpFilter === category);
    });

    document.querySelectorAll('.allergen-def-card').forEach(card => {
      if (category === 'all' || card.dataset.defCat === category) {
        card.classList.remove('hidden-by-filter');
      } else {
        card.classList.add('hidden-by-filter');
      }
    });
  }

  function openAndSpotlightAllergenDef(defKey) {
    toggleAllergenHelpDrawer(true);
    filterAllergenDefinitions('all');

    document.querySelectorAll('.allergen-def-card').forEach(card => {
      const isMatch = card.dataset.defId === defKey;
      card.classList.toggle('spotlight-card', isMatch);
      if (isMatch) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // ==========================================================================
  // MULTI-DOG PACK ROSTER & CONFIGURATION MANAGEMENT
  // ==========================================================================
  function renderDogRosterChips() {
    if (!el.dogRosterChips) return;
    el.dogRosterChips.innerHTML = '';

    appState.dogs.forEach(dog => {
      const isAct = dog.id === appState.activeDogId;
      const chip = document.createElement('div');
      chip.className = `dog-chip ${isAct ? 'active' : ''}`;
      chip.title = `Switch telemetry calibration to ${dog.name} (${capitalize(dog.size)}, ${capitalize(dog.coat)} coat, ${dog.allergy === 'sensitive' ? 'Allergy-Sensitive' : 'Standard'})`;
      chip.innerHTML = `
        <span>🐾 ${dog.name.toUpperCase()}</span>
      `;
      chip.addEventListener('click', () => {
        playHardwareClick(700);
        setActiveDog(dog.id);
      });
      el.dogRosterChips.appendChild(chip);
    });
  }

  function setActiveDog(dogId) {
    appState.activeDogId = dogId;
    localStorage.setItem('pawcast_active_dog_id', dogId);
    updateUIPreferences();
    renderDogRosterChips();
    if (appState.weather) {
      renderAllWeatherData(appState.weather);
    }
  }

  function renderModalDogList(editingId) {
    if (!el.modalDogList) return;
    el.modalDogList.innerHTML = '';

    appState.dogs.forEach(dog => {
      const chip = document.createElement('div');
      chip.className = `dog-chip ${dog.id === editingId ? 'active' : ''}`;
      chip.innerHTML = `<span>🐾 ${dog.name.toUpperCase()}</span>`;
      chip.addEventListener('click', () => {
        playHardwareClick(660);
        setActiveDog(dog.id);
        populateFormWithDog(dog);
        renderModalDogList(dog.id);
      });
      el.modalDogList.appendChild(chip);
    });
  }

  function openPetModal(targetMode) {
    if (targetMode === 'NEW') {
      populateFormForNewDog();
    } else {
      const dog = getActiveDog();
      populateFormWithDog(dog);
    }
    el.petModal.classList.remove('hidden');
  }

  function populateFormWithDog(dog) {
    el.dogIdInput.value = dog.id;
    el.dogNameInput.value = dog.name;
    el.dogSizeSelect.value = dog.size || 'medium';
    el.dogCoatSelect.value = dog.coat || 'double';
    el.dogSnoutSelect.value = dog.snout || 'normal';
    if (el.dogAllergySelect) el.dogAllergySelect.value = dog.allergy || 'normal';
    el.dogAgeSelect.value = dog.age || 'adult';
    if (el.deleteDogBtn) {
      el.deleteDogBtn.style.display = appState.dogs.length > 1 ? 'inline-flex' : 'none';
    }
    renderModalDogList(dog.id);
  }

  function populateFormForNewDog() {
    el.dogIdInput.value = '';
    el.dogNameInput.value = '';
    el.dogNameInput.placeholder = 'Enter new dog name (e.g. Cooper, Daisy)...';
    el.dogSizeSelect.value = 'medium';
    el.dogCoatSelect.value = 'short';
    el.dogSnoutSelect.value = 'normal';
    if (el.dogAllergySelect) el.dogAllergySelect.value = 'normal';
    el.dogAgeSelect.value = 'adult';
    if (el.deleteDogBtn) {
      el.deleteDogBtn.style.display = 'none';
    }
    renderModalDogList('');
    el.dogNameInput.focus();
  }

  function closePetModal() {
    el.petModal.classList.add('hidden');
  }

  function handleSavePetProfile(e) {
    e.preventDefault();
    playHardwareClick(860);

    const existingId = el.dogIdInput.value;
    const nameVal = el.dogNameInput.value.trim() || 'My Dog';
    const updatedDog = {
      id: existingId || ('dog_' + Date.now()),
      name: nameVal,
      size: el.dogSizeSelect.value,
      coat: el.dogCoatSelect.value,
      snout: el.dogSnoutSelect.value,
      allergy: el.dogAllergySelect ? el.dogAllergySelect.value : 'normal',
      age: el.dogAgeSelect.value
    };

    const idx = appState.dogs.findIndex(d => d.id === existingId);
    if (idx >= 0) {
      appState.dogs[idx] = updatedDog;
    } else {
      appState.dogs.push(updatedDog);
    }

    appState.activeDogId = updatedDog.id;
    saveJSON('pawcast_dogs', appState.dogs);
    localStorage.setItem('pawcast_active_dog_id', appState.activeDogId);

    updateUIPreferences();
    renderDogRosterChips();
    closePetModal();
    if (appState.weather) renderAllWeatherData(appState.weather);
  }

  function handleDeleteDog() {
    if (appState.dogs.length <= 1) return;
    const targetId = el.dogIdInput.value;
    if (!targetId) return;

    playHardwareClick(440);
    appState.dogs = appState.dogs.filter(d => d.id !== targetId);
    appState.activeDogId = appState.dogs[0].id;

    saveJSON('pawcast_dogs', appState.dogs);
    localStorage.setItem('pawcast_active_dog_id', appState.activeDogId);

    updateUIPreferences();
    renderDogRosterChips();
    populateFormWithDog(getActiveDog());
    if (appState.weather) renderAllWeatherData(appState.weather);
  }

  function handleExportConfiguration() {
    playHardwareClick(900);
    const configPayload = {
      version: '5.0',
      exportedAt: new Date().toISOString(),
      dogs: appState.dogs,
      activeDogId: appState.activeDogId,
      favorites: appState.favorites,
      location: appState.location,
      units: appState.units,
      source: appState.source,
      refreshIntervalMins: appState.refreshIntervalMins
    };

    const blob = new Blob([JSON.stringify(configPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pawcast_pack_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      } catch (e) { /* ignore */ }
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
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.08, ctx.currentTime);
      if (el.acousticStatusText) el.acousticStatusText.textContent = 'Acoustic: Rain Patter & Wind';
    } else {
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
  // LIVE DOPPLER RADAR ENGINE (ESRI WORLD DARK GRAY + RAINVIEWER ZOOM 3-7)
  // ==========================================================================
  const DEFAULT_RADAR_ZOOM = 7;
  const MIN_RADAR_ZOOM = 3;
  const MAX_RADAR_ZOOM = 7;

  function initLiveRadarMap() {
    if (!window.L || !el.radarMapEl) return;

    appState.radarMap = L.map(el.radarMapEl, {
      center: [appState.location.lat, appState.location.lon],
      zoom: DEFAULT_RADAR_ZOOM,
      minZoom: MIN_RADAR_ZOOM,
      maxZoom: MAX_RADAR_ZOOM,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: MAX_RADAR_ZOOM,
      minZoom: MIN_RADAR_ZOOM,
      attribution: '&copy; Esri, &copy; OpenStreetMap contributors'
    }).addTo(appState.radarMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: MAX_RADAR_ZOOM,
      minZoom: MIN_RADAR_ZOOM,
      opacity: 0.9
    }).addTo(appState.radarMap);

    appState.radarMap.on('zoom zoomend', updateRadarZoomTracker);
    updateRadarZoomTracker();

    fetchRadarFrames();
  }

  function updateRadarZoomTracker() {
    const zoomEl = document.getElementById('radar-zoom-level');
    if (!zoomEl || !appState.radarMap) return;
    const z = appState.radarMap.getZoom();
    zoomEl.textContent = `ZOOM ${z}`;
    zoomEl.title = `Current map zoom: ${z} (radar supports ${MIN_RADAR_ZOOM}–${MAX_RADAR_ZOOM}; default ${DEFAULT_RADAR_ZOOM})`;
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
        tileSize: 256,
        minZoom: MIN_RADAR_ZOOM,
        maxZoom: MAX_RADAR_ZOOM
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
      const zoom = Math.min(
        Math.max(appState.radarMap.getZoom() || DEFAULT_RADAR_ZOOM, MIN_RADAR_ZOOM),
        MAX_RADAR_ZOOM
      );
      appState.radarMap.setView([lat, lon], zoom);
      updateRadarZoomTracker();
    }
  }

  // ==========================================================================
  // TELEMETRY ACQUISITION (OPEN-METEO, CAMS AIR QUALITY & NOAA NWS)
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
      const aqPromise = fetchAirQualityData(loc.lat, loc.lon);
      const omPromise = fetchOpenMeteoData(loc.lat, loc.lon).catch(() => null);

      if (appState.source === 'nws' && loc.country === 'United States') {
        const [nwsData, omData] = await Promise.all([
          fetchNWSData(loc.lat, loc.lon),
          omPromise
        ]);
        if (nwsData) {
          // Enrich NWS with Open-Meteo 7-day rolling forecast & solar/visibility almanac if needed
          if (omData) {
            if (nwsData.daily.length < 7) {
              const existingDates = new Set(nwsData.daily.map(d => d.date.toDateString()));
              omData.daily.forEach(omDay => {
                if (nwsData.daily.length < 7 && !existingDates.has(omDay.date.toDateString())) {
                  nwsData.daily.push(omDay);
                }
              });
            }
            nwsData.daily = nwsData.daily.slice(0, 7).map((d, idx) => ({
              ...d,
              sunrise: d.sunrise || (omData.daily[idx] && omData.daily[idx].sunrise) || null,
              sunset: d.sunset || (omData.daily[idx] && omData.daily[idx].sunset) || null,
              precipSumMm: typeof d.precipSumMm === 'number' ? d.precipSumMm : (omData.daily[idx] ? omData.daily[idx].precipSumMm : 0),
              maxWindKmh: d.maxWindKmh || (omData.daily[idx] ? omData.daily[idx].maxWindKmh : 12)
            }));
            nwsData.current.gustKmh = nwsData.current.gustKmh || omData.current.gustKmh;
            nwsData.current.visibilityM = nwsData.current.visibilityM || omData.current.visibilityM;
            nwsData.current.precipMm = omData.current.precipMm || 0;
          }
          data = nwsData;
          el.activeSourceName.textContent = 'NOAA NWS + CAMS AQI + RAINVIEWER';
        }
      }

      if (!data) {
        data = await omPromise;
        el.activeSourceName.textContent = 'OPEN-METEO WMO + CAMS AQI + RAINVIEWER';
      }

      if (!data) throw new Error('All weather sources failed');

      appState.airQuality = await aqPromise;
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

  async function fetchAirQualityData(lat, lon) {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,ozone,dust,grass_pollen,birch_pollen,ragweed_pollen,alder_pollen,mugwort_pollen,olive_pollen&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = await res.json();
      return raw.current || null;
    } catch (e) {
      console.warn('Air quality fetch warning:', e);
      return null;
    }
  }

  function computeAeroallergenProfile(curWeather, aqData, lat) {
    const tempF = (curWeather.tempC * 9 / 5) + 32;
    const rh = curWeather.humidity || 50;
    const windMph = (curWeather.windKmh || 8) * 0.621371;
    const isRaining = curWeather.weatherCode >= 51 && curWeather.weatherCode <= 82;
    const month = new Date().getMonth();
    const isNorthern = lat >= 0;
    const adjMonth = isNorthern ? month : (month + 6) % 12;

    const rainWashout = isRaining ? 0.35 : 1.0;
    const windDispersion = Math.min(1.35, 0.8 + (windMph / 25));

    let grassScore = 1.2;
    if (aqData && typeof aqData.grass_pollen === 'number' && aqData.grass_pollen !== null) {
      grassScore = Math.min(10, (aqData.grass_pollen / 60) * 10);
    } else {
      let seasonalBase = 1.0;
      if (adjMonth >= 4 && adjMonth <= 6) seasonalBase = 6.8;
      else if (adjMonth === 3 || adjMonth === 7) seasonalBase = 4.5;
      else if (adjMonth === 8 || adjMonth === 9) seasonalBase = 2.6;
      const tempFactor = tempF < 42 ? 0.15 : tempF > 92 ? 0.7 : 1.0;
      grassScore = seasonalBase * tempFactor * windDispersion * rainWashout;
    }

    let treeScore = 1.0;
    const rawTree = aqData && (aqData.birch_pollen !== null || aqData.alder_pollen !== null)
      ? (aqData.birch_pollen || 0) + (aqData.alder_pollen || 0) + (aqData.olive_pollen || 0)
      : null;
    if (rawTree !== null) {
      treeScore = Math.min(10, (rawTree / 120) * 10);
    } else {
      let seasonalBase = 0.8;
      if (adjMonth >= 2 && adjMonth <= 4) seasonalBase = 7.4;
      else if (adjMonth === 1 || adjMonth === 5) seasonalBase = 4.2;
      else if (adjMonth === 9) seasonalBase = 1.5;
      const tempFactor = tempF < 36 ? 0.1 : 1.0;
      treeScore = seasonalBase * tempFactor * windDispersion * rainWashout;
    }

    let weedScore = 1.5;
    const rawWeed = aqData && (aqData.ragweed_pollen !== null || aqData.mugwort_pollen !== null)
      ? (aqData.ragweed_pollen || 0) + (aqData.mugwort_pollen || 0)
      : null;
    if (rawWeed !== null) {
      weedScore = Math.min(10, (rawWeed / 80) * 10);
    } else {
      let seasonalBase = 1.0;
      if (adjMonth >= 7 && adjMonth <= 9) seasonalBase = 6.9;
      else if (adjMonth === 6 || adjMonth === 10) seasonalBase = 3.8;
      const frostKill = tempF <= 32 ? 0.1 : tempF < 50 ? 0.55 : 1.05;
      weedScore = seasonalBase * frostKill * windDispersion * rainWashout;
    }

    let moldScore = 1.8;
    const humidityFactor = rh >= 80 ? 2.1 : rh >= 65 ? 1.45 : rh <= 35 ? 0.5 : 0.9;
    const autumnLeafFactor = (adjMonth >= 8 && adjMonth <= 10) ? 1.4 : 1.0;
    const rainBoost = isRaining ? 1.35 : 1.0;
    const freezeFactor = tempF < 32 ? 0.15 : 1.0;
    moldScore = Math.min(10, 2.2 * humidityFactor * autumnLeafFactor * rainBoost * freezeFactor);

    grassScore = Math.max(0.2, Math.min(10, Number(grassScore.toFixed(1))));
    treeScore = Math.max(0.2, Math.min(10, Number(treeScore.toFixed(1))));
    weedScore = Math.max(0.2, Math.min(10, Number(weedScore.toFixed(1))));
    moldScore = Math.max(0.2, Math.min(10, Number(moldScore.toFixed(1))));

    const usAqi = (aqData && typeof aqData.us_aqi === 'number') ? Math.round(aqData.us_aqi) : 34;
    const pm25 = (aqData && typeof aqData.pm2_5 === 'number') ? aqData.pm2_5.toFixed(1) : '7.2';
    const pm10 = (aqData && typeof aqData.pm10 === 'number') ? aqData.pm10.toFixed(1) : '12.4';
    const ozone = (aqData && typeof aqData.ozone === 'number') ? Math.round(aqData.ozone) : 68;

    return {
      grassScore,
      treeScore,
      weedScore,
      moldScore,
      usAqi,
      pm25,
      pm10,
      ozone
    };
  }

  function renderAllergyTelemetry(curWeather) {
    if (!el.pollenGrassVal) return;
    const pet = getActiveDog();
    const profile = computeAeroallergenProfile(curWeather, appState.airQuality, appState.location.lat);

    const setChannelUI = (valEl, barEl, score) => {
      let tier = 'LOW';
      let cls = 'safe';
      if (score >= 6.5) {
        tier = 'HIGH';
        cls = 'danger';
      } else if (score >= 3.5) {
        tier = 'MODERATE';
        cls = 'caution';
      }
      valEl.textContent = `${tier} (${score.toFixed(1)} / 10)`;
      barEl.className = `allergen-bar-fill ${cls}`;
      barEl.style.width = `${Math.max(5, score * 10)}%`;
    };

    setChannelUI(el.pollenGrassVal, el.pollenGrassBar, profile.grassScore);
    setChannelUI(el.pollenTreeVal, el.pollenTreeBar, profile.treeScore);
    setChannelUI(el.pollenWeedVal, el.pollenWeedBar, profile.weedScore);
    setChannelUI(el.pollenMoldVal, el.pollenMoldBar, profile.moldScore);

    el.aqiNumVal.textContent = `${profile.usAqi}`;
    el.pm25Val.textContent = `${profile.pm25} µg/m³`;
    el.pm10Val.textContent = `${profile.pm10} µg/m³`;
    el.ozoneVal.textContent = `${profile.ozone} µg/m³`;

    let aqiCat = 'GOOD';
    if (profile.usAqi > 150) aqiCat = 'UNHEALTHY';
    else if (profile.usAqi > 100) aqiCat = 'SENSITIVE HAZARD';
    else if (profile.usAqi > 50) aqiCat = 'MODERATE';
    el.aqiBadge.textContent = `US AQI: ${profile.usAqi} (${aqiCat})`;

    const maxPollen = Math.max(profile.grassScore, profile.treeScore, profile.weedScore, profile.moldScore);
    const isAtopicDog = pet.allergy === 'sensitive';
    const isBrachy = pet.snout === 'brachy';
    const effectivePollenRisk = maxPollen + (isAtopicDog ? 1.5 : 0);
    const effectiveAqiRisk = profile.usAqi + (isBrachy ? 20 : 0);

    let overallStatus = 'green';
    let badgeLabel = 'ALLERGY RISK: LOW';
    let verdictTitle = 'CLEAN AIR & LOW SEASONAL POLLEN';
    let verdictDesc = `Air quality is ${aqiCat.toLowerCase()} (AQI ${profile.usAqi}) with minimal airborne pollen. Ideal conditions for outdoor exercise, yard work, and walking ${pet.name}.`;
    let sinusLabel = '🌬️ Sinus / Hay Fever: Low';
    let exerciseLabel = '🏃 Outdoor Exercise: Ideal';
    let canineLabel = `🐾 ${pet.name}: Standard Coat Check`;

    if (effectivePollenRisk >= 6.8 || effectiveAqiRisk >= 115) {
      overallStatus = 'red';
      badgeLabel = 'ALLERGY RISK: HIGH';
      verdictTitle = 'ELEVATED POLLEN & PARTICULATE ADVISORY';
      verdictDesc = `High seasonal aeroallergen or particulate load detected. Allergy sufferers may experience sinus congestion; limit prolonged afternoon cardio and wipe ${pet.name}'s paws/coat after walks.`;
      sinusLabel = '🌬️ Sinus / Hay Fever: High';
      exerciseLabel = profile.usAqi > 100 ? '🏃 Exercise: Limit Cardio' : '🏃 Exercise: Morning Best';
      canineLabel = `🐾 ${pet.name}: Wipe Paws & Coat`;
    } else if (effectivePollenRisk >= 3.8 || effectiveAqiRisk >= 65) {
      overallStatus = 'yellow';
      badgeLabel = 'ALLERGY RISK: MODERATE';
      verdictTitle = 'MODERATE SEASONAL POLLEN & SPORE ACTIVITY';
      verdictDesc = `Moderate airborne pollen and mold spores present. Sensitive individuals may notice mild hay fever symptoms on breezy afternoons. Quick paw rinse advised for ${pet.name} after grassy walks.`;
      sinusLabel = '🌬️ Sinus / Hay Fever: Moderate';
      exerciseLabel = '🏃 Outdoor Exercise: Good';
      canineLabel = `🐾 ${pet.name}: Rinse Paws if Itchy`;
    }

    el.allergyOverallBadge.textContent = badgeLabel;
    el.allergyProtocolCard.className = `allergy-protocol-card status-${overallStatus}`;
    el.allergyOverallBadge.className = `status-pill`;

    if (overallStatus === 'yellow') {
      el.allergyOverallBadge.style.background = 'rgba(234, 179, 8, 0.15)';
      el.allergyOverallBadge.style.color = '#EAB308';
      el.allergyOverallBadge.style.borderColor = 'rgba(234, 179, 8, 0.4)';
    } else if (overallStatus === 'red') {
      el.allergyOverallBadge.style.background = 'rgba(239, 68, 68, 0.18)';
      el.allergyOverallBadge.style.color = '#EF4444';
      el.allergyOverallBadge.style.borderColor = 'rgba(239, 68, 68, 0.45)';
    } else {
      el.allergyOverallBadge.style.background = 'rgba(34, 197, 94, 0.15)';
      el.allergyOverallBadge.style.color = '#22C55E';
      el.allergyOverallBadge.style.borderColor = 'rgba(34, 197, 94, 0.35)';
    }

    el.allergyVerdictTitle.textContent = verdictTitle;
    el.allergyVerdictDesc.textContent = verdictDesc;
    if (el.symptomWatchRow) {
      el.symptomWatchRow.innerHTML = `
        <span class="symptom-chip" title="Human allergic rhinitis / hay fever outlook">${sinusLabel}</span>
        <span class="symptom-chip" title="Outdoor running, cycling, and recreational air quality outlook">${exerciseLabel}</span>
        <span class="symptom-chip" title="Canine companion adjunct guidance for ${pet.name}">${canineLabel}</span>
      `;
    }
  }

  async function fetchOpenMeteoData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,weather_code,surface_pressure,wind_speed_10m,uv_index,visibility,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset&forecast_days=8&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo failed');
    const raw = await res.json();
    return parseOpenMeteoPayload(raw);
  }

  function parseOpenMeteoPayload(raw) {
    const cur = raw.current;
    const h = raw.hourly;
    const d = raw.daily;

    // Find current local hour index so the 24-hour horizon starts NOW and rolls forward 24 hours
    const nowMs = Date.now() - (30 * 60 * 1000);
    let startHourIdx = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= nowMs) {
        startHourIdx = i;
        break;
      }
    }

    const hourlyList = [];
    for (let i = startHourIdx; i < startHourIdx + 24 && i < h.time.length; i++) {
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
        visibilityM: h.visibility ? h.visibility[i] : 16000,
        isDay: h.is_day ? h.is_day[i] === 1 : (new Date(h.time[i]).getHours() >= 6 && new Date(h.time[i]).getHours() < 20)
      });
    }

    // Build guaranteed 7-day rolling forecast starting from today
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    let startDayIdx = d.time.findIndex(t => t >= todayStr);
    if (startDayIdx < 0) startDayIdx = 0;

    const dailyList = [];
    for (let i = startDayIdx; i < d.time.length && dailyList.length < 7; i++) {
      dailyList.push({
        date: new Date(d.time[i] + 'T12:00:00'),
        maxTempC: d.temperature_2m_max[i],
        minTempC: d.temperature_2m_min[i],
        weatherCode: d.weather_code[i],
        pop: d.precipitation_probability_max[i] || 0,
        precipSumMm: d.precipitation_sum ? (d.precipitation_sum[i] || 0) : 0,
        maxWindKmh: d.wind_speed_10m_max ? (d.wind_speed_10m_max[i] || 10) : 10,
        uv: d.uv_index_max[i] || 0,
        sunrise: d.sunrise ? d.sunrise[i] : null,
        sunset: d.sunset ? d.sunset[i] : null
      });
    }

    const curHourRef = hourlyList[0] || {};

    return {
      current: {
        tempC: cur.temperature_2m,
        feelsC: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        weatherCode: cur.weather_code,
        windKmh: cur.wind_speed_10m,
        gustKmh: cur.wind_gusts_10m || Math.round(cur.wind_speed_10m * 1.35),
        windDir: cur.wind_direction_10m,
        pressure: cur.surface_pressure,
        precipMm: cur.precipitation || 0,
        visibilityM: curHourRef.visibilityM || 16093,
        isDay: cur.is_day === 1,
        dewC: typeof curHourRef.dewC === 'number' ? curHourRef.dewC : (cur.temperature_2m - ((100 - cur.relative_humidity_2m) / 5)),
        pop: typeof curHourRef.pop === 'number' ? curHourRef.pop : 0,
        uv: typeof curHourRef.uv === 'number' ? curHourRef.uv : 0
      },
      hourly: hourlyList,
      daily: dailyList
    };
  }

  async function fetchNWSData(lat, lon) {
    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
        headers: { 'User-Agent': 'PawCastFieldStation/5.0' }
      });
      if (!pointRes.ok) return null;
      const pointData = await pointRes.json();

      const hRes = await fetch(pointData.properties.forecastHourly, {
        headers: { 'User-Agent': 'PawCastFieldStation/5.0' }
      });
      if (!hRes.ok) return null;
      const hData = await hRes.json();

      const periods = hData.properties.periods;
      if (!periods || !periods.length) return null;

      const first = periods[0];
      const tempC = (first.temperature - 32) * 5 / 9;

      // Map ALL 156 hourly periods so buildDailyFromHourly produces a full 7-day rolling forecast
      const allHourly = periods.map(p => {
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
          visibilityM: 16093,
          isDay: p.isDaytime
        };
      });

      const hourlyList = allHourly.slice(0, 24);
      const curWindKmh = parseWindSpeedKmh(first.windSpeed);

      return {
        current: {
          tempC: tempC,
          feelsC: tempC,
          humidity: first.relativeHumidity ? first.relativeHumidity.value : 50,
          weatherCode: nwsConditionToCode(first.shortForecast),
          windKmh: curWindKmh,
          gustKmh: Math.round(curWindKmh * 1.35),
          windDir: 180,
          pressure: 1015,
          precipMm: 0,
          visibilityM: 16093,
          isDay: first.isDaytime,
          dewC: tempC - 5,
          pop: first.probabilityOfPrecipitation ? first.probabilityOfPrecipitation.value || 0 : 0,
          uv: first.isDaytime ? 4 : 0
        },
        hourly: hourlyList,
        daily: buildDailyFromHourly(allHourly)
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
    const pet = getActiveDog();
    const surfaces = calculateSurfaceTemps(tempF, isDay, uv, windMph);

    let pawStatus = 'green';
    let pawPill = 'PAWS SAFE';
    let pawTitle = 'ALL SURFACES SAFE';
    let pawDesc = `Asphalt (~${surfaces.asphaltF}°F) and lawn turf (~${surfaces.grassF}°F) are comfortable for walking ${pet.name}.`;

    if (surfaces.asphaltF >= 125) {
      pawStatus = 'red';
      pawPill = 'HOT ASPHALT';
      pawTitle = 'ASPHALT PAW BURN HAZARD';
      pawDesc = `Blacktop is ~${surfaces.asphaltF}°F in direct sun. Walk ${pet.name} on natural grass (~${surfaces.grassF}°F) or shaded paths.`;
    } else if (surfaces.asphaltF >= 105) {
      pawStatus = 'yellow';
      pawPill = 'WARM PAVEMENT';
      pawTitle = 'WARM BLACKTOP SURFACE';
      pawDesc = `Asphalt is warming (~${surfaces.asphaltF}°F). Prefer grassy park strips (~${surfaces.grassF}°F) for ${pet.name}.`;
    }

    if (tempF < 32) {
      if (tempF < 20) {
        pawStatus = 'red';
        pawPill = 'FREEZE HAZARD';
        pawTitle = 'SUB-FREEZING GROUND & SALT';
        pawDesc = `Frigid pavement and road de-icers. Consider winter booties or a coat for ${pet.name}.`;
      } else {
        pawStatus = 'yellow';
        pawPill = 'CHILLY GROUND';
        pawTitle = 'FROSTY PAVEMENT & SALT WATCH';
        pawDesc = `Near-freezing ground. Wipe ${pet.name}'s paws after walks if sidewalks are salted.`;
      }
    }

    let heatSensitivityOffset = 0;
    if (pet.snout === 'brachy') heatSensitivityOffset += 5;
    if (pet.coat === 'double' || pet.coat === 'dark') heatSensitivityOffset += 3;
    if (pet.size === 'small') heatSensitivityOffset += 2;
    if (pet.age === 'senior' || pet.age === 'puppy') heatSensitivityOffset += 2;

    const heatIndexF = tempF + (humidity > 60 ? (humidity - 60) * 0.15 : 0);
    const adjustedHeatIndex = heatIndexF + heatSensitivityOffset;

    let heatStatus = 'green';
    let heatPill = 'COMFORTABLE';
    let heatTitle = 'PLEASANT OUTDOOR WEATHER';
    let heatDesc = `Comfortable air mass (${Math.round(tempF)}°F, ${humidity}% RH) for outdoor activities, recreation, and walking.`;

    if (tempF >= 90 || adjustedHeatIndex >= 94) {
      heatStatus = 'red';
      heatPill = 'HEAT ADVISORY';
      heatTitle = 'HIGH HEAT & HUMIDITY LOAD';
      heatDesc = `Hot thermal index (${Math.round(heatIndexF)}°F). Stay hydrated, seek shade midday, and keep ${pet.name}'s walks brief.`;
    } else if (tempF >= 80 || adjustedHeatIndex >= 83) {
      heatStatus = 'yellow';
      heatPill = 'WARM & HUMID';
      heatTitle = 'WARM OUTDOOR CONDITIONS';
      heatDesc = `Warm afternoon air (${Math.round(tempF)}°F). Bring water for extended outdoor exercise or walks with ${pet.name}.`;
    } else if (tempF < 32) {
      heatStatus = 'yellow';
      heatPill = 'FREEZING';
      heatTitle = 'BELOW-FREEZING TEMPERATURES';
      heatDesc = `Sub-freezing air (${Math.round(tempF)}°F). Dress in warm layers and watch for icy patches.`;
    } else if (tempF < 48) {
      heatStatus = 'green';
      heatPill = 'CRISP / BRISK';
      heatTitle = 'CRISP JACKET WEATHER';
      heatDesc = `Cool, refreshing conditions (${Math.round(tempF)}°F). Light jacket recommended; great cooling weather for ${pet.name}.`;
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
    const pet = getActiveDog();
    const todayDaily = data.daily[0] || {};

    document.body.classList.toggle('is-night-mode', !cur.isDay);

    const mainTemp = isImp ? Math.round((cur.tempC * 9 / 5) + 32) : Math.round(cur.tempC);
    const feelsTemp = isImp ? Math.round((cur.feelsC * 9 / 5) + 32) : Math.round(cur.feelsC);
    const dewDisp = isImp ? Math.round((cur.dewC * 9 / 5) + 32) : Math.round(cur.dewC);
    const unitSym = isImp ? '°F' : '°C';
    const compassDir = degToCompass(cur.windDir);
    const windSpeedVal = isImp ? Math.round(cur.windKmh * 0.621371) : Math.round(cur.windKmh);
    const gustSpeedVal = isImp ? Math.round((cur.gustKmh || cur.windKmh * 1.3) * 0.621371) : Math.round(cur.gustKmh || cur.windKmh * 1.3);
    const speedUnit = isImp ? 'mph' : 'km/h';
    const windSpeedStr = `${windSpeedVal} ${speedUnit}`;

    const highC = typeof todayDaily.maxTempC === 'number' ? todayDaily.maxTempC : cur.tempC + 3;
    const lowC = typeof todayDaily.minTempC === 'number' ? todayDaily.minTempC : cur.tempC - 4;
    const highDisp = isImp ? Math.round((highC * 9 / 5) + 32) : Math.round(highC);
    const lowDisp = isImp ? Math.round((lowC * 9 / 5) + 32) : Math.round(lowC);

    const condition = getWeatherConditionInfo(cur.weatherCode, cur.isDay);

    el.currentTemp.textContent = `${mainTemp}°`;
    el.tempHigh.textContent = `HIGH ${highDisp}°`;
    el.tempLow.textContent = `LOW ${lowDisp}°`;
    el.weatherConditionText.textContent = condition.label.toUpperCase();
    el.weatherMainEmoji.textContent = condition.emoji;
    el.weatherMainEmoji.title = `${condition.label}: ${condition.detail}`;

    const safety = calculateDualSafetyIndex(cur.tempC, cur.humidity, cur.windKmh, cur.isDay, cur.uv);

    // Card 1: Primary Atmospheric & Solar Almanac
    el.boxHeatSafety.className = `instrument-gauge status-${safety.heatStatus}`;
    if (el.heatStatusPill) el.heatStatusPill.textContent = safety.heatPill;
    el.heatStatusTitle.textContent = safety.heatTitle;
    el.heatSafetyDesc.textContent = safety.heatDesc;
    el.feelsLikeVal.textContent = `${feelsTemp}${unitSym}`;
    el.humidityVal.textContent = `${cur.humidity}% · Dew ${dewDisp}°`;

    if (el.heroWindVal) {
      el.heroWindVal.textContent = `${windSpeedVal} ${compassDir} (G${gustSpeedVal})`;
    }
    if (el.heroSunVal) {
      el.heroSunVal.textContent = formatSunTimes(todayDaily.sunrise, todayDaily.sunset);
    }
    const visMiles = ((cur.visibilityM || 16093) / 1609.34).toFixed(1);
    const visKm = ((cur.visibilityM || 16093) / 1000).toFixed(1);
    const visStr = isImp ? `${Math.min(10, Number(visMiles)).toFixed(1)} mi` : `${Math.min(16, Number(visKm)).toFixed(1)} km`;
    if (el.heroVisVal) {
      el.heroVisVal.textContent = visStr;
    }
    if (el.heroMoonVal) {
      el.heroMoonVal.textContent = getLunarPhase();
    }

    // Card 2: Canine Companion Adjunct
    el.boxPawSafety.className = `instrument-gauge status-${safety.pawStatus}`;
    if (el.pawStatusPill) el.pawStatusPill.textContent = safety.pawPill;
    el.pawStatusTitle.textContent = safety.pawTitle;
    el.pawSafetyDesc.textContent = safety.pawDesc;
    el.asphaltTempVal.textContent = isImp ? `${safety.surfaces.asphaltF}°F` : `${safety.surfaces.asphaltC}°C`;
    el.grassTempVal.textContent = isImp ? `${safety.surfaces.grassF}°F` : `${safety.surfaces.grassC}°C`;
    if (el.subjectCoatVal) el.subjectCoatVal.textContent = `🐾 ${pet.name.toUpperCase()} · ${pet.coat.toUpperCase()}`;
    if (el.weeklyPackTag) el.weeklyPackTag.textContent = `🐾 ADJUNCT: ${pet.name.toUpperCase()} (${appState.dogs.length} IN PACK)`;

    if (el.pawThermalNeedle) {
      const clampedF = Math.max(25, Math.min(145, safety.surfaces.asphaltF));
      const pct = ((clampedF - 25) / (145 - 25)) * 92 + 4;
      el.pawThermalNeedle.style.left = `${pct.toFixed(1)}%`;
    }

    // Instrument 05: Atmospheric Sensor Dials
    el.metricPop.textContent = `${cur.pop}%`;
    if (el.barPop) el.barPop.style.width = `${Math.min(100, cur.pop)}%`;
    const todayPrecipMm = todayDaily.precipSumMm || cur.precipMm || 0;
    if (el.metricPrecipSub) {
      const precipDisp = isImp ? `${(todayPrecipMm / 25.4).toFixed(2)} in` : `${todayPrecipMm.toFixed(1)} mm`;
      el.metricPrecipSub.textContent = `${precipDisp} expected today`;
    }

    el.metricWind.textContent = `${windSpeedStr} ${compassDir}`;
    if (el.metricGustSub) {
      el.metricGustSub.textContent = `Gusts to ${gustSpeedVal} ${speedUnit}`;
    }

    el.metricHumidity.textContent = `${cur.humidity}%`;
    if (el.barHum) el.barHum.style.width = `${Math.min(100, cur.humidity)}%`;
    if (el.metricHumSub) {
      el.metricHumSub.textContent = cur.humidity > 70 ? 'Humid / Muggy air mass' : cur.humidity < 30 ? 'Crisp / Dry air mass' : 'Comfortable air moisture';
    }

    el.metricUv.textContent = `${cur.uv} (${getUvCategory(cur.uv)})`;
    if (el.barUv) el.barUv.style.width = `${Math.min(100, (cur.uv / 11) * 100)}%`;
    if (el.metricUvSub) {
      el.metricUvSub.textContent = cur.uv >= 6 ? 'High UV — Sunscreen & shade advised' : cur.uv >= 3 ? 'Moderate UV — Sunglasses/SPF midday' : 'Low solar UV exposure';
    }

    el.metricDewpoint.textContent = `${dewDisp}${unitSym}`;
    if (el.metricVisSub) {
      el.metricVisSub.textContent = `Visibility: ${visStr}`;
    }

    const hPa = Math.round(cur.pressure || 1015);
    const inHg = (hPa * 0.02953).toFixed(2);
    const baroRegime = hPa >= 1020 ? 'High Pressure · Fair' : hPa <= 1008 ? 'Low Pressure · Unsettled' : 'Standard · Steady';
    if (isImp) {
      el.metricPressure.textContent = `${inHg} inHg`;
      if (el.baroUnitLabel) el.baroUnitLabel.textContent = 'inHg';
      if (el.metricBaroSub) el.metricBaroSub.textContent = `${hPa} hPa · ${baroRegime}`;
    } else {
      el.metricPressure.textContent = `${hPa} hPa`;
      if (el.baroUnitLabel) el.baroUnitLabel.textContent = 'hPa';
      if (el.metricBaroSub) el.metricBaroSub.textContent = `${inHg} inHg · ${baroRegime}`;
    }

    renderDailyForecast(data.daily);
    renderWalkWindows(data.hourly);
    renderHourlyForecast(data.hourly);
    renderAllergyTelemetry(cur);
  }

  // Render Top Rolling 7-Day Weather Forecast Ribbon
  function renderDailyForecast(daily) {
    const isImp = appState.units === 'imperial';
    const pet = getActiveDog();
    el.dailyList.innerHTML = '';

    // Guarantee 7 rolling days even if an upstream response was short
    const sevenDays = [...daily];
    while (sevenDays.length > 0 && sevenDays.length < 7) {
      const last = sevenDays[sevenDays.length - 1];
      const nextDate = new Date(last.date.getTime() + 86400000);
      sevenDays.push({
        ...last,
        date: nextDate
      });
    }

    sevenDays.slice(0, 7).forEach((d, i) => {
      const dayName = i === 0 ? 'TODAY' : d.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dateSub = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
      const cond = getWeatherConditionInfo(d.weatherCode, true);
      const maxT = isImp ? Math.round((d.maxTempC * 9 / 5) + 32) : Math.round(d.maxTempC);
      const minT = isImp ? Math.round((d.minTempC * 9 / 5) + 32) : Math.round(d.minTempC);
      const windVal = isImp ? Math.round((d.maxWindKmh || 12) * 0.621371) : Math.round(d.maxWindKmh || 12);
      const windUnit = isImp ? 'mph' : 'km/h';

      const saf = calculateDualSafetyIndex(d.maxTempC, 50, d.maxWindKmh || 10, true, d.uv);
      let overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                          saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';
      let statusText = overallStatus === 'green' ? '🐾 Walk: Good' : overallStatus === 'yellow' ? '🐾 Warm/Brisk' : '🐾 Caution';
      if (d.pop >= 65 && overallStatus === 'green') {
        overallStatus = 'yellow';
        statusText = '🐾 Wet Walk';
      }

      const card = document.createElement('div');
      card.className = `week-day-card ${i === 0 ? 'is-today' : ''}`;
      card.title = `${dayName}, ${dateSub} — ${cond.label}\nHigh: ${maxT}° | Low: ${minT}° | Rain Prob: ${d.pop}% | Max Wind: ${windVal} ${windUnit} | Peak UV: ${d.uv}\nAdjunct (${pet.name}): ${saf.pawTitle} (Peak Pavement ~${saf.surfaces.asphaltF}°F)`;
      card.innerHTML = `
        <div class="wk-day-top">
          <span class="wk-day-name">${dayName}</span>
          <span class="wk-day-date">${dateSub}</span>
        </div>
        <span class="wk-day-emoji" title="${cond.label}: ${cond.detail}">${cond.emoji}</span>
        <span class="wk-cond-label">${cond.label}</span>
        <div class="wk-temp-pair">
          <span class="wk-high">${maxT}°</span>
          <span class="wk-low">${minT}°</span>
        </div>
        <div class="wk-meta-row">
          <span class="wk-pop" title="Precipitation Probability: ${d.pop}%">💧 ${d.pop}%</span>
          <span class="wk-wind" title="Peak Daily Wind: ${windVal} ${windUnit}">💨 ${windVal}${isImp ? 'm' : 'k'}</span>
        </div>
        <span class="wk-paw-pill ${overallStatus}" title="Canine Adjunct (${pet.name}): ${saf.pawTitle}">${statusText}</span>
      `;
      el.dailyList.appendChild(card);
    });
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
      circleTitle.textContent = `${Math.round(p.val)}° // ${p.safety.heatTitle} (Pavement: ~${p.safety.surfaces.asphaltF}°F)`;
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

    hourly.forEach((h, idx) => {
      const tVal = isImp ? Math.round((h.tempC * 9 / 5) + 32) : Math.round(h.tempC);
      const windVal = isImp ? Math.round(h.windKmh * 0.621371) : Math.round(h.windKmh);
      const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const timeStr = idx === 0 ? 'NOW' : h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';

      const statusLabel = h.pop >= 50 ? `💧 ${h.pop}%` : (overallStatus === 'green' ? 'IDEAL' : overallStatus === 'yellow' ? 'WARM' : 'ALERT');

      const toolTipMeaning = `${timeStr} — ${cond.label}\nTemp: ${tVal}° | Rain Prob: ${h.pop}% | Wind: ${windVal} ${isImp ? 'mph' : 'km/h'} | UV: ${h.uv}\nPavement Est: ~${saf.surfaces.asphaltF}°F (${saf.pawTitle})`;

      const card = document.createElement('div');
      card.className = 'hour-card';
      card.title = toolTipMeaning;

      card.innerHTML = `
        <span class="hour-time">${timeStr}</span>
        <span class="hour-emoji" title="${cond.label}: ${cond.detail}">${cond.emoji}</span>
        <span class="hour-temp" title="Ambient Air: ${tVal}°">${tVal}°</span>
        <span class="hour-paw-badge ${overallStatus}" title="${toolTipMeaning}">${statusLabel}</span>
      `;
      el.hourlyScroller.appendChild(card);
    });
  }

  function renderWalkWindows(hourly) {
    const isImp = appState.units === 'imperial';
    el.walkWindowsGrid.innerHTML = '';
    const windows = [];

    hourly.forEach((h, idx) => {
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const tVal = isImp ? Math.round((h.tempC * 9 / 5) + 32) : Math.round(h.tempC);
      const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
      const timeLabel = idx === 0 ? 'NOW' : h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const isOverallSafe = saf.pawStatus === 'green' && saf.heatStatus === 'green' && h.pop < 40;
      const isModerate = (saf.pawStatus === 'yellow' || h.pop < 55) && saf.heatStatus !== 'red';

      if (isOverallSafe) {
        windows.push({
          timeStr: `${timeLabel} · ${tVal}° ${cond.emoji}`,
          status: 'best',
          label: 'IDEAL OUTDOORS & WALK'
        });
      } else if (isModerate) {
        windows.push({
          timeStr: `${timeLabel} · ${tVal}° ${cond.emoji}`,
          status: 'caution',
          label: saf.pawStatus === 'yellow' ? 'SHADE / TURF ADVISED' : 'FAIR CONDITIONS'
        });
      }
    });

    const displayWindows = windows.slice(0, 5);

    if (displayWindows.length === 0) {
      el.walkWindowsGrid.innerHTML = `
        <div class="window-card caution">
          <span class="window-time">WEATHER ADVISORY</span>
          <span class="window-tag">Plan outdoor activities for early morning or evening hours</span>
        </div>
      `;
      return;
    }

    displayWindows.forEach(w => {
      const card = document.createElement('div');
      card.className = `window-card ${w.status}`;
      card.title = `Recommended Outdoor & Walk Slot: ${w.timeStr} (${w.label})`;
      card.innerHTML = `
        <span class="window-time">${w.timeStr}</span>
        <span class="window-tag">${w.label}</span>
      `;
      el.walkWindowsGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // GEOCODING, GPS, UNITS & FAVORITES
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
    const activeDog = getActiveDog();
    el.profileBtnLabel.textContent = `PACK: ${activeDog.name.toUpperCase()} (${appState.dogs.length})`;
  }

  function setUnits(unit) {
    appState.units = unit;
    localStorage.setItem('pawcast_units', unit);
    updateUIPreferences();
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
      const key = h.time.toLocaleDateString('en-CA');
      if (!map[key]) {
        map[key] = {
          date: new Date(key + 'T12:00:00'),
          maxTempC: h.tempC,
          minTempC: h.tempC,
          weatherCode: h.weatherCode,
          pop: h.pop || 0,
          maxWindKmh: h.windKmh || 10,
          uv: h.uv || 0
        };
      } else {
        map[key].maxTempC = Math.max(map[key].maxTempC, h.tempC);
        map[key].minTempC = Math.min(map[key].minTempC, h.tempC);
        map[key].pop = Math.max(map[key].pop, h.pop || 0);
        map[key].maxWindKmh = Math.max(map[key].maxWindKmh, h.windKmh || 10);
        map[key].uv = Math.max(map[key].uv, h.uv || 0);
      }
    });
    return Object.values(map).slice(0, 7);
  }

  function formatSunTimes(sunriseIso, sunsetIso) {
    if (!sunriseIso || !sunsetIso) return '6:45a / 6:30p';
    try {
      const sr = new Date(sunriseIso);
      const ss = new Date(sunsetIso);
      const fmt = (dt) => {
        const h = dt.getHours();
        const m = dt.getMinutes();
        const h12 = h % 12 || 12;
        const mStr = m < 10 ? `0${m}` : `${m}`;
        const ampm = h < 12 ? 'a' : 'p';
        return `${h12}:${mStr}${ampm}`;
      };
      return `${fmt(sr)} / ${fmt(ss)}`;
    } catch (e) {
      return '6:45a / 6:30p';
    }
  }

  function getLunarPhase(date = new Date()) {
    const lp = 2551443; // Lunar synodic period in seconds
    const newMoonRef = new Date(Date.UTC(1970, 0, 7, 20, 35, 0));
    const phase = ((date.getTime() - newMoonRef.getTime()) / 1000) % lp;
    const ageDays = Math.floor(phase / 86400);

    if (ageDays < 2) return '🌑 New Moon';
    if (ageDays < 7) return '🌒 Waxing Cres';
    if (ageDays < 9) return '🌓 First Qtr';
    if (ageDays < 14) return '🌔 Waxing Gib';
    if (ageDays < 16) return '🌕 Full Moon';
    if (ageDays < 21) return '🌖 Waning Gib';
    if (ageDays < 23) return '🌗 Last Qtr';
    return '🌘 Waning Cres';
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
