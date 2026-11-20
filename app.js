/* ==========================================================================
   PAWCAST // METEOROLOGICAL & CANINE FIELD STATION ENGINE (REV 6.0)
   Includes:
   - Accessible Combobox Search + GPS Reverse Geocoding + Split City Chips
   - Multi-Dog Pack Roster, Cross-Pack Alerts, JSON Export/Import & Undo Toasts
   - Interactive 7-Day Forecast with Temp Range Bars & Day Detail Drawer
   - Interactive Undistorted 24-Hour SVG Chart + Synchronized Hour Inspector
   - Live RainViewer Doppler Radar with Timeline Scrubber, Step Controls & City Pin
   - Aeroallergen, Pollen Spectrum & US EPA AQI Bio-Monitor (Live vs Model badge)
   - 100% Consistent Imperial/Metric Formatting & Modal Keyboard Focus Trap
   - Procedural Web Audio API Weather Soundscape & Tactile Hardware Clicks
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
    { name: 'New York', state: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060 },
    { name: 'London', state: 'England', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', state: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
    { name: 'Los Angeles', state: 'California', country: 'United States', lat: 34.0522, lon: -118.2437 }
  ];

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
    searchResultsData: [],
    searchActiveIdx: -1,

    // Interactive Selection State
    selectedDayIdx: null,
    selectedHourIdx: 0,
    lastUpdatedAt: null,
    modalTriggerEl: null,

    // Auto-Polling State
    refreshIntervalMins: parseInt(localStorage.getItem('pawcast_refresh_interval') || '10', 10),
    nextRefreshTimestamp: Date.now() + (10 * 60 * 1000),
    countdownTimer: null,
    isRefreshing: false,

    // Doppler Radar Scope State
    radarMap: null,
    radarCityMarker: null,
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
    stationLed: document.getElementById('station-led'),
    lastUpdatedTag: document.getElementById('last-updated-tag'),
    locationInput: document.getElementById('location-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    searchResults: document.getElementById('search-results'),
    geoBtn: document.getElementById('geo-btn'),
    unitF: document.getElementById('unit-f'),
    unitC: document.getElementById('unit-c'),
    headerRefreshBtn: document.getElementById('header-refresh-btn'),
    petProfileBtn: document.getElementById('pet-profile-btn'),
    profileBtnLabel: document.getElementById('profile-btn-label'),
    settingsToggleBtn: document.getElementById('settings-toggle-btn'),
    stationSettingsDrawer: document.getElementById('station-settings-drawer'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundBtnLabel: document.getElementById('sound-btn-label'),
    acousticStatusText: document.getElementById('acoustic-status-text'),

    // Weather Status & Error Banner
    weatherStatusBanner: document.getElementById('weather-status-banner'),
    weatherStatusText: document.getElementById('weather-status-text'),
    weatherRetryBtn: document.getElementById('weather-retry-btn'),

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
    cityRegion: document.getElementById('city-region'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    heroFeelsInline: document.getElementById('hero-feels-inline'),
    tempHigh: document.getElementById('temp-high'),
    tempLow: document.getElementById('temp-low'),
    weatherConditionText: document.getElementById('weather-condition-text'),
    weatherMainEmoji: document.getElementById('weather-main-emoji'),
    heroRealtimeAllergyBar: document.getElementById('hero-realtime-allergy-bar'),
    heroAllergyPill: document.getElementById('hero-allergy-pill'),
    heroDominantPollen: document.getElementById('hero-dominant-pollen'),
    heroAqiPill: document.getElementById('hero-aqi-pill'),

    // Dual Precision Gauges
    boxPawSafety: document.getElementById('box-paw-safety'),
    pawStatusPill: document.getElementById('paw-status-pill'),
    pawStatusTitle: document.getElementById('paw-status-title'),
    pawThermalTrack: document.getElementById('paw-thermal-track'),
    pawThermalNeedle: document.getElementById('paw-thermal-needle'),
    scaleLblFreeze: document.getElementById('scale-lbl-freeze'),
    scaleLblIdeal: document.getElementById('scale-lbl-ideal'),
    scaleLblWarm: document.getElementById('scale-lbl-warm'),
    scaleLblHot: document.getElementById('scale-lbl-hot'),
    asphaltTempVal: document.getElementById('asphalt-temp-val'),
    grassTempVal: document.getElementById('grass-temp-val'),
    pawSafetyDesc: document.getElementById('paw-safety-desc'),
    walkChecklistRow: document.getElementById('walk-checklist-row'),
    packAdvisoryBanner: document.getElementById('pack-advisory-banner'),

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

    // Top 7-Day Weekly Forecast Grid, Detail Drawer & Walk Windows
    dailyList: document.getElementById('daily-list'),
    dayDetailDrawer: document.getElementById('day-detail-drawer'),
    walkWindowsGrid: document.getElementById('walk-windows-grid'),

    // Live Radar Scope
    radarMapEl: document.getElementById('radar-map'),
    radarPrevBtn: document.getElementById('radar-prev-btn'),
    radarPlayBtn: document.getElementById('radar-play-btn'),
    radarPlayIcon: document.getElementById('radar-play-icon'),
    radarPlayText: document.getElementById('radar-play-text'),
    radarNextBtn: document.getElementById('radar-next-btn'),
    radarRecenterBtn: document.getElementById('radar-recenter-btn'),
    radarTimestamp: document.getElementById('radar-timestamp'),
    radarScrubber: document.getElementById('radar-scrubber'),
    radarFrameCounter: document.getElementById('radar-frame-counter'),

    // Hourly Horizon & Inspector
    hourlySvg: document.getElementById('hourly-svg'),
    hourlyScroller: document.getElementById('hourly-scroller'),
    hourlyScrollLeft: document.getElementById('hourly-scroll-left'),
    hourlyScrollRight: document.getElementById('hourly-scroll-right'),
    inspTime: document.getElementById('insp-time'),
    inspCond: document.getElementById('insp-cond'),
    inspAir: document.getElementById('insp-air'),
    inspFeels: document.getElementById('insp-feels'),
    inspPavement: document.getElementById('insp-pavement'),
    inspRain: document.getElementById('insp-rain'),
    inspWind: document.getElementById('insp-wind'),
    inspUv: document.getElementById('insp-uv'),

    // Aeroallergen & Air Quality Bio-Monitor
    allergyDataSourceTag: document.getElementById('allergy-data-source-tag'),
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
    dogSensitivityPreview: document.getElementById('dog-sensitivity-preview'),
    deleteDogBtn: document.getElementById('delete-dog-btn'),
    exportConfigBtn: document.getElementById('export-config-btn'),
    importConfigBtn: document.getElementById('import-config-btn'),
    importConfigFile: document.getElementById('import-config-file'),
    petProfileForm: document.getElementById('pet-profile-form'),
    dogIdInput: document.getElementById('dog-id'),
    dogNameInput: document.getElementById('dog-name'),
    dogSizeSelect: document.getElementById('dog-size'),
    dogCoatSelect: document.getElementById('dog-coat'),
    dogSnoutSelect: document.getElementById('dog-snout'),
    dogAllergySelect: document.getElementById('dog-allergy'),
    dogAgeSelect: document.getElementById('dog-age'),

    // Toasts
    toastContainer: document.getElementById('toast-container')
  };

  function init() {
    setupEventListeners();
    initQuickNavScrollSpy();
    updateUIPreferences();
    renderDogRosterChips();
    renderFavoriteChips();
    initLiveRadarMap();
    initAutoRefreshSystem();
    fetchWeatherData(appState.location);
  }

  // ==========================================================================
  // TOAST NOTIFICATIONS (NON-BLOCKING + UNDO SUPPORT)
  // ==========================================================================
  function showToast(message, options = {}) {
    if (!el.toastContainer) return;
    const { type = 'info', undoLabel = null, onUndo = null, durationMs = 4500 } = options;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.remove();
    };

    if (undoLabel && typeof onUndo === 'function') {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = undoLabel;
      undoBtn.addEventListener('click', () => {
        playHardwareClick(780);
        onUndo();
        dismiss();
      });
      toast.appendChild(undoBtn);
    }

    el.toastContainer.appendChild(toast);
    setTimeout(dismiss, undoLabel ? Math.max(durationMs, 6500) : durationMs);
  }

  // ==========================================================================
  // QUICK NAV SCROLL SPY
  // ==========================================================================
  function initQuickNavScrollSpy() {
    const links = Array.from(document.querySelectorAll('.quick-nav-link'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sectionMap = new Map();
    links.forEach(link => {
      const id = link.dataset.section;
      const target = document.getElementById(id);
      if (target) sectionMap.set(target, link);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const activeLink = sectionMap.get(entry.target);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, { rootMargin: '-18% 0px -65% 0px', threshold: 0.05 });

    sectionMap.forEach((_, sectionEl) => observer.observe(sectionEl));
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================
  function setupEventListeners() {
    // Accessible City Search Combobox
    el.locationInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (el.clearSearchBtn) {
        el.clearSearchBtn.classList.toggle('hidden', query.length === 0);
      }
      clearTimeout(appState.searchDebounce);
      if (query.length < 2) {
        closeSearchDropdown();
        return;
      }
      appState.searchDebounce = setTimeout(() => fetchGeocoding(query), 280);
    });

    el.locationInput.addEventListener('keydown', (e) => {
      const isOpen = !el.searchResults.classList.contains('hidden');
      const count = appState.searchResultsData.length;

      if (e.key === 'ArrowDown' && isOpen && count > 0) {
        e.preventDefault();
        appState.searchActiveIdx = (appState.searchActiveIdx + 1) % count;
        updateSearchActiveHighlight();
      } else if (e.key === 'ArrowUp' && isOpen && count > 0) {
        e.preventDefault();
        appState.searchActiveIdx = (appState.searchActiveIdx - 1 + count) % count;
        updateSearchActiveHighlight();
      } else if (e.key === 'Enter' && isOpen && count > 0) {
        e.preventDefault();
        const pickIdx = appState.searchActiveIdx >= 0 ? appState.searchActiveIdx : 0;
        selectSearchLocation(appState.searchResultsData[pickIdx]);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeSearchDropdown();
      }
    });

    if (el.clearSearchBtn) {
      el.clearSearchBtn.addEventListener('click', () => {
        el.locationInput.value = '';
        el.clearSearchBtn.classList.add('hidden');
        closeSearchDropdown();
        el.locationInput.focus();
      });
    }

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

    if (el.headerRefreshBtn) {
      el.headerRefreshBtn.addEventListener('click', () => {
        playHardwareClick(820);
        triggerRefresh();
      });
    }

    if (el.settingsToggleBtn) {
      el.settingsToggleBtn.addEventListener('click', () => {
        playHardwareClick(640);
        toggleSettingsDrawer();
      });
    }

    if (el.weatherRetryBtn) {
      el.weatherRetryBtn.addEventListener('click', () => {
        playHardwareClick(760);
        fetchWeatherData(appState.location);
      });
    }

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
      openPetModal(appState.activeDogId, el.petProfileBtn);
    });

    if (el.addDogQuickBtn) {
      el.addDogQuickBtn.addEventListener('click', () => {
        playHardwareClick(780);
        openPetModal('NEW', el.addDogQuickBtn);
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

    if (el.importConfigBtn && el.importConfigFile) {
      el.importConfigBtn.addEventListener('click', () => {
        playHardwareClick(700);
        el.importConfigFile.value = '';
        el.importConfigFile.click();
      });
      el.importConfigFile.addEventListener('change', handleImportConfiguration);
    }

    // Live Dog Sensitivity Preview inside Modal
    [el.dogSizeSelect, el.dogCoatSelect, el.dogSnoutSelect, el.dogAllergySelect, el.dogAgeSelect].forEach(sel => {
      if (sel) sel.addEventListener('change', updateModalSensitivityPreview);
    });

    el.closeModalBtn.addEventListener('click', closePetModal);
    el.cancelModalBtn.addEventListener('click', closePetModal);
    el.petProfileForm.addEventListener('submit', handleSavePetProfile);

    // Click backdrop outside dialog to close modal
    if (el.petModal) {
      el.petModal.addEventListener('click', (e) => {
        if (e.target === el.petModal) {
          closePetModal();
        }
      });
    }

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

    if (el.heroRealtimeAllergyBar) {
      el.heroRealtimeAllergyBar.addEventListener('click', () => {
        playHardwareClick(680);
        const panel = document.getElementById('allergy-monitor-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    document.querySelectorAll('.inline-help-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playHardwareClick(740);
        openAndSpotlightAllergenDef(btn.dataset.helpTarget);
      });
    });

    document.querySelectorAll('.help-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        playHardwareClick(640);
        filterAllergenDefinitions(tab.dataset.helpFilter);
      });
    });

    // Hourly Strip Scroll Arrows
    if (el.hourlyScrollLeft && el.hourlyScroller) {
      el.hourlyScrollLeft.addEventListener('click', () => {
        el.hourlyScroller.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }
    if (el.hourlyScrollRight && el.hourlyScroller) {
      el.hourlyScrollRight.addEventListener('click', () => {
        el.hourlyScroller.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }

    // Radar Transport & Scrubber Controls
    el.radarPlayBtn.addEventListener('click', () => {
      playHardwareClick(760);
      toggleRadarAnimation();
    });

    if (el.radarPrevBtn) {
      el.radarPrevBtn.addEventListener('click', () => {
        playHardwareClick(620);
        stepRadarFrame(-1);
      });
    }

    if (el.radarNextBtn) {
      el.radarNextBtn.addEventListener('click', () => {
        playHardwareClick(680);
        stepRadarFrame(1);
      });
    }

    if (el.radarRecenterBtn) {
      el.radarRecenterBtn.addEventListener('click', () => {
        playHardwareClick(740);
        updateRadarCenter(appState.location.lat, appState.location.lon, DEFAULT_RADAR_ZOOM);
      });
    }

    if (el.radarScrubber) {
      el.radarScrubber.addEventListener('input', (e) => {
        stopRadarAnimation();
        const idx = parseInt(e.target.value, 10);
        if (!isNaN(idx) && appState.radarFrames[idx]) {
          appState.radarCurrentFrameIdx = idx;
          showRadarFrame(idx);
        }
      });
    }

    // Global Keyboard Handlers (Escape & Modal Focus Trap)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && el.petModal && !el.petModal.classList.contains('hidden')) {
        trapModalFocus(e);
        return;
      }

      if (e.key === 'Escape') {
        // Dismiss any active hover/focus help popovers (WCAG 1.4.13)
        document.querySelectorAll('.help-popover').forEach(p => {
          p.classList.add('dismissed');
          setTimeout(() => p.classList.remove('dismissed'), 400);
        });

        if (el.petModal && !el.petModal.classList.contains('hidden')) {
          closePetModal();
        } else if (el.allergenHelpDrawer && !el.allergenHelpDrawer.classList.contains('hidden')) {
          toggleAllergenHelpDrawer(false);
        } else if (el.stationSettingsDrawer && !el.stationSettingsDrawer.classList.contains('hidden')) {
          toggleSettingsDrawer(false);
        } else if (appState.selectedDayIdx !== null) {
          closeDayDetailDrawer();
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && appState.refreshIntervalMins > 0) {
        checkAndExecuteAutoRefresh();
      }
    });

    document.addEventListener('click', (e) => {
      if (!el.locationInput.contains(e.target) && !el.searchResults.contains(e.target)) {
        closeSearchDropdown();
      }
    });
  }

  function trapModalFocus(e) {
    const focusables = Array.from(
      el.petModal.querySelectorAll('button:not([disabled]):not([style*="display: none"]), input:not([type="hidden"]):not(.sr-only), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(node => node.offsetParent !== null);

    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function toggleSettingsDrawer(forceOpen) {
    if (!el.stationSettingsDrawer) return;
    const isHidden = el.stationSettingsDrawer.classList.contains('hidden');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

    el.stationSettingsDrawer.classList.toggle('hidden', !shouldOpen);
    el.stationSettingsDrawer.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    if (el.settingsToggleBtn) {
      el.settingsToggleBtn.classList.toggle('active', shouldOpen);
      el.settingsToggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
  }

  function toggleAllergenHelpDrawer(forceOpen) {
    if (!el.allergenHelpDrawer) return;
    const isCurrentlyHidden = el.allergenHelpDrawer.classList.contains('hidden');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyHidden;

    el.allergenHelpDrawer.classList.toggle('hidden', !shouldOpen);
    el.allergenHelpDrawer.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    if (el.allergenHelpToggleBtn) {
      el.allergenHelpToggleBtn.classList.toggle('active', shouldOpen);
      el.allergenHelpToggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
    if (el.allergenHelpBtnText) {
      el.allergenHelpBtnText.textContent = shouldOpen ? 'Hide Guide' : 'Allergen Guide';
    }
    if (!shouldOpen) {
      document.querySelectorAll('.allergen-def-card').forEach(c => c.classList.remove('spotlight-card'));
    }
  }

  function filterAllergenDefinitions(category) {
    document.querySelectorAll('.help-tab').forEach(t => {
      const isSelected = t.dataset.helpFilter === category;
      t.classList.toggle('active', isSelected);
      t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    document.querySelectorAll('.allergen-def-card').forEach(card => {
      card.classList.toggle('hidden-by-filter', !(category === 'all' || card.dataset.defCat === category));
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
  // MULTI-DOG PACK ROSTER & CONFIGURATION MANAGEMENT (WITH IMPORT + UNDO)
  // ==========================================================================
  function renderDogRosterChips() {
    if (!el.dogRosterChips) return;
    el.dogRosterChips.innerHTML = '';

    appState.dogs.forEach(dog => {
      const isAct = dog.id === appState.activeDogId;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `dog-chip ${isAct ? 'active' : ''}`;
      chip.setAttribute('aria-pressed', isAct ? 'true' : 'false');
      chip.title = `Switch active dog profile to ${dog.name} (${capitalize(dog.size)}, ${capitalize(dog.coat)} coat, ${dog.allergy === 'sensitive' ? 'Allergy-Sensitive' : 'Standard'})`;
      chip.textContent = `🐾 ${dog.name}`;
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
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `dog-chip ${dog.id === editingId ? 'active' : ''}`;
      chip.textContent = `🐾 ${dog.name}`;
      chip.addEventListener('click', () => {
        playHardwareClick(660);
        setActiveDog(dog.id);
        populateFormWithDog(dog);
        renderModalDogList(dog.id);
      });
      el.modalDogList.appendChild(chip);
    });
  }

  function updateModalSensitivityPreview() {
    if (!el.dogSensitivityPreview) return;
    const size = el.dogSizeSelect.value;
    const coat = el.dogCoatSelect.value;
    const snout = el.dogSnoutSelect.value;
    const allergy = el.dogAllergySelect ? el.dogAllergySelect.value : 'normal';
    const age = el.dogAgeSelect.value;

    const notes = [];
    let heatPts = 0;
    if (snout === 'brachy') {
      heatPts += 5;
      notes.push('Flat-faced: stricter heat & AQI limits');
    }
    if (coat === 'double' || coat === 'dark') {
      heatPts += 3;
      notes.push(coat === 'double' ? 'Double coat: warms faster, tolerates cold better' : 'Dark coat: absorbs extra solar heat');
    }
    if (coat === 'hairless') {
      notes.push('Thin/hairless: high UV & cold sensitivity');
    }
    if (size === 'small') {
      heatPts += 2;
      notes.push('Small size: chills faster in cold weather');
    } else if (size === 'large') {
      heatPts += 2;
      notes.push('Large size: retains body heat in warm weather');
    }
    if (age === 'senior' || age === 'puppy') {
      heatPts += 2;
      notes.push(`${capitalize(age)}: extra heat/cold margin`);
    }
    if (allergy === 'sensitive') {
      notes.push('Allergy-sensitive: earlier pollen alerts & paw-wipe reminders');
    }

    const heatSummary = heatPts > 0 ? `+${heatPts}°F heat margin` : 'Standard heat margin';
    el.dogSensitivityPreview.textContent = notes.length
      ? `Profile calibration: ${heatSummary} · ${notes.join(' · ')}`
      : `Profile calibration: ${heatSummary} · Balanced outdoor walk thresholds.`;
  }

  function openPetModal(targetMode, triggerEl) {
    appState.modalTriggerEl = triggerEl || document.activeElement;
    if (targetMode === 'NEW') {
      populateFormForNewDog();
    } else {
      populateFormWithDog(getActiveDog());
    }
    el.petModal.classList.remove('hidden');
    el.petModal.setAttribute('aria-hidden', 'false');
    if (el.dogNameInput) el.dogNameInput.focus();
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
    updateModalSensitivityPreview();
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
    updateModalSensitivityPreview();
    el.dogNameInput.focus();
  }

  function closePetModal() {
    el.petModal.classList.add('hidden');
    el.petModal.setAttribute('aria-hidden', 'true');
    const restoreTarget = appState.modalTriggerEl || el.petProfileBtn;
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
      restoreTarget.focus();
    }
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
    const isNew = idx < 0;
    if (!isNew) {
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
    showToast(`${isNew ? 'Added' : 'Saved'} dog profile for ${updatedDog.name}.`, { type: 'success' });
  }

  function handleDeleteDog() {
    if (appState.dogs.length <= 1) return;
    const targetId = el.dogIdInput.value;
    if (!targetId) return;

    const dogIndex = appState.dogs.findIndex(d => d.id === targetId);
    if (dogIndex < 0) return;
    const removedDog = appState.dogs[dogIndex];
    const previousActiveId = appState.activeDogId;

    playHardwareClick(440);
    appState.dogs = appState.dogs.filter(d => d.id !== targetId);
    appState.activeDogId = appState.dogs[0].id;

    saveJSON('pawcast_dogs', appState.dogs);
    localStorage.setItem('pawcast_active_dog_id', appState.activeDogId);

    updateUIPreferences();
    renderDogRosterChips();
    populateFormWithDog(getActiveDog());
    if (appState.weather) renderAllWeatherData(appState.weather);

    showToast(`Removed ${removedDog.name} from saved dogs.`, {
      type: 'info',
      undoLabel: 'Undo',
      onUndo: () => {
        appState.dogs.splice(Math.min(dogIndex, appState.dogs.length), 0, removedDog);
        appState.activeDogId = previousActiveId;
        saveJSON('pawcast_dogs', appState.dogs);
        localStorage.setItem('pawcast_active_dog_id', appState.activeDogId);
        updateUIPreferences();
        renderDogRosterChips();
        if (!el.petModal.classList.contains('hidden')) {
          populateFormWithDog(removedDog);
        }
        if (appState.weather) renderAllWeatherData(appState.weather);
        showToast(`Restored ${removedDog.name}.`, { type: 'success' });
      }
    });
  }

  function handleExportConfiguration() {
    playHardwareClick(900);
    const configPayload = {
      version: '6.0',
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
    showToast('Backup JSON downloaded.', { type: 'success' });
  }

  function handleImportConfiguration(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!Array.isArray(parsed.dogs) || parsed.dogs.length === 0) {
          throw new Error('No dog profiles found in backup file.');
        }

        const sanitizedDogs = parsed.dogs
          .filter(d => d && typeof d.name === 'string' && d.name.trim())
          .map((d, idx) => ({
            id: typeof d.id === 'string' && d.id ? d.id : `dog_imp_${Date.now()}_${idx}`,
            name: d.name.trim().slice(0, 40),
            size: ['small', 'medium', 'large'].includes(d.size) ? d.size : 'medium',
            coat: ['short', 'double', 'hairless', 'dark'].includes(d.coat) ? d.coat : 'short',
            snout: ['normal', 'brachy'].includes(d.snout) ? d.snout : 'normal',
            allergy: ['normal', 'sensitive'].includes(d.allergy) ? d.allergy : 'normal',
            age: ['puppy', 'adult', 'senior'].includes(d.age) ? d.age : 'adult'
          }));

        if (!sanitizedDogs.length) throw new Error('Invalid dog profile entries.');

        appState.dogs = sanitizedDogs;
        appState.activeDogId = sanitizedDogs.some(d => d.id === parsed.activeDogId)
          ? parsed.activeDogId
          : sanitizedDogs[0].id;
        saveJSON('pawcast_dogs', appState.dogs);
        localStorage.setItem('pawcast_active_dog_id', appState.activeDogId);

        if (Array.isArray(parsed.favorites) && parsed.favorites.length > 0) {
          appState.favorites = parsed.favorites.filter(f => f && f.name && typeof f.lat === 'number' && typeof f.lon === 'number');
          saveJSON('pawcast_favorites', appState.favorites);
        }

        if (parsed.units === 'imperial' || parsed.units === 'metric') {
          appState.units = parsed.units;
          localStorage.setItem('pawcast_units', appState.units);
        }

        if (parsed.location && typeof parsed.location.lat === 'number' && typeof parsed.location.lon === 'number') {
          appState.location = parsed.location;
          saveJSON('pawcast_location', appState.location);
        }

        updateUIPreferences();
        renderDogRosterChips();
        renderFavoriteChips();
        populateFormWithDog(getActiveDog());
        fetchWeatherData(appState.location);
        showToast(`Restored ${appState.dogs.length} dog profile(s) and ${appState.favorites.length} saved city(ies).`, { type: 'success' });
      } catch (err) {
        showToast(`Import failed: ${err.message || 'Invalid JSON backup file.'}`, { type: 'error' });
      }
    };
    reader.readAsText(file);
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
      el.soundToggleBtn.setAttribute('aria-pressed', 'true');
      el.soundBtnLabel.textContent = 'Weather Audio: On';
      playHardwareClick(880);
      syncAmbientSoundscape();
    } else {
      el.soundToggleBtn.classList.remove('active');
      el.soundToggleBtn.setAttribute('aria-pressed', 'false');
      el.soundBtnLabel.textContent = 'Weather Audio: Off';
      stopAmbientSoundscape();
      if (el.acousticStatusText) {
        el.acousticStatusText.textContent = 'Live Station';
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
      if (el.acousticStatusText) el.acousticStatusText.textContent = 'Audio: Rain & Wind';
    } else {
      filter.type = 'lowpass';
      const cutoff = Math.min(600, 160 + windKmh * 10);
      filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.055, ctx.currentTime);
      if (el.acousticStatusText) {
        el.acousticStatusText.textContent = isDay ? 'Audio: Breeze & Birds' : 'Audio: Evening Crickets';
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
        if (isDay) triggerSongbirdNote(ctx);
        else triggerCricketPulse(ctx);
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
        triggerRefresh();
      });
    }

    resetAutoRefreshTimer();
  }

  function resetAutoRefreshTimer() {
    clearInterval(appState.countdownTimer);
    if (appState.refreshIntervalMins <= 0) {
      if (el.refreshCountdown) el.refreshCountdown.textContent = 'Paused';
      return;
    }

    appState.nextRefreshTimestamp = Date.now() + (appState.refreshIntervalMins * 60 * 1000);
    updateCountdownUI();
    appState.countdownTimer = setInterval(checkAndExecuteAutoRefresh, 1000);
  }

  function checkAndExecuteAutoRefresh() {
    if (appState.refreshIntervalMins <= 0 || appState.isRefreshing) return;
    if (appState.nextRefreshTimestamp - Date.now() <= 0) {
      triggerRefresh();
    } else {
      updateCountdownUI();
    }
  }

  function updateCountdownUI() {
    if (!el.refreshCountdown) return;
    if (appState.refreshIntervalMins <= 0) {
      el.refreshCountdown.textContent = 'Paused';
      return;
    }

    const remainingMs = Math.max(0, appState.nextRefreshTimestamp - Date.now());
    const totalSecs = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    el.refreshCountdown.textContent = `Next: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  async function triggerRefresh() {
    if (appState.isRefreshing) return;
    appState.isRefreshing = true;

    [el.refreshNowBtn, el.headerRefreshBtn].forEach(btn => {
      if (btn) btn.classList.add('spinning');
    });

    if (el.refreshCountdown) el.refreshCountdown.textContent = 'Updating...';

    try {
      await fetchWeatherData(appState.location);
      await fetchRadarFrames();
    } catch (e) {
      console.warn('Weather refresh error:', e);
    } finally {
      appState.isRefreshing = false;
      [el.refreshNowBtn, el.headerRefreshBtn].forEach(btn => {
        if (btn) setTimeout(() => btn.classList.remove('spinning'), 350);
      });
      resetAutoRefreshTimer();
    }
  }

  // ==========================================================================
  // LIVE DOPPLER RADAR ENGINE (CLEAN LAYER LIFECYCLE + SCRUBBER + CITY PIN)
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
      minZoom: MIN_RADAR_ZOOM
    }).addTo(appState.radarMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: MAX_RADAR_ZOOM,
      minZoom: MIN_RADAR_ZOOM,
      opacity: 0.9
    }).addTo(appState.radarMap);

    const cityIcon = L.divIcon({
      className: 'radar-city-pin-wrapper',
      html: '<div class="radar-city-pin"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    appState.radarCityMarker = L.marker([appState.location.lat, appState.location.lon], {
      icon: cityIcon,
      interactive: false
    }).addTo(appState.radarMap);

    appState.radarMap.on('zoom zoomend', updateRadarZoomTracker);
    updateRadarZoomTracker();
    fetchRadarFrames();
  }

  function updateRadarZoomTracker() {
    const zoomEl = document.getElementById('radar-zoom-level');
    if (!zoomEl || !appState.radarMap) return;
    const z = appState.radarMap.getZoom();
    zoomEl.textContent = `Zoom ${z}`;
    zoomEl.title = `Current map zoom: ${z} (radar supports ${MIN_RADAR_ZOOM}–${MAX_RADAR_ZOOM}; default ${DEFAULT_RADAR_ZOOM})`;
  }

  function clearOldRadarLayers() {
    if (!appState.radarMap) return;
    appState.radarLayers.forEach(layer => {
      if (layer && appState.radarMap.hasLayer(layer)) {
        appState.radarMap.removeLayer(layer);
      }
    });
    appState.radarLayers = [];
  }

  async function fetchRadarFrames() {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) return;
      const data = await res.json();

      const frames = [];
      const pastCount = (data.radar && Array.isArray(data.radar.past)) ? data.radar.past.length : 0;
      if (data.radar && data.radar.past) {
        data.radar.past.forEach(f => frames.push({ ...f, isForecast: false }));
      }
      if (data.radar && data.radar.nowcast) {
        data.radar.nowcast.forEach(f => frames.push({ ...f, isForecast: true }));
      }

      stopRadarAnimation();
      clearOldRadarLayers();
      appState.radarFrames = frames;

      if (frames.length > 0) {
        // Default to most recent live radar frame (end of past) rather than future nowcast
        appState.radarCurrentFrameIdx = pastCount > 0 ? pastCount - 1 : frames.length - 1;
        if (el.radarScrubber) {
          el.radarScrubber.min = '0';
          el.radarScrubber.max = String(frames.length - 1);
          el.radarScrubber.value = String(appState.radarCurrentFrameIdx);
          el.radarScrubber.disabled = false;
        }
        showRadarFrame(appState.radarCurrentFrameIdx);
      }
    } catch (e) {
      console.warn('RainViewer Radar API error:', e);
      el.radarTimestamp.textContent = 'Radar Unavailable';
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
    const tagPrefix = frame.isForecast ? 'Forecast' : 'Live Radar';
    el.radarTimestamp.textContent = `${tagPrefix} · ${timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

    if (el.radarScrubber) el.radarScrubber.value = String(index);
    if (el.radarFrameCounter) {
      el.radarFrameCounter.textContent = `Frame ${index + 1}/${appState.radarFrames.length}`;
    }
  }

  function stepRadarFrame(delta) {
    if (!appState.radarFrames.length) return;
    stopRadarAnimation();
    const len = appState.radarFrames.length;
    appState.radarCurrentFrameIdx = (appState.radarCurrentFrameIdx + delta + len) % len;
    showRadarFrame(appState.radarCurrentFrameIdx);
  }

  function toggleRadarAnimation() {
    if (appState.isRadarPlaying) stopRadarAnimation();
    else startRadarAnimation();
  }

  function startRadarAnimation() {
    if (appState.radarFrames.length === 0) return;
    appState.isRadarPlaying = true;
    el.radarPlayIcon.textContent = '⏸';
    el.radarPlayText.textContent = 'Pause Radar';
    el.radarPlayBtn.setAttribute('aria-pressed', 'true');

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
    el.radarPlayText.textContent = 'Play Radar';
    el.radarPlayBtn.setAttribute('aria-pressed', 'false');
  }

  function updateRadarCenter(lat, lon, explicitZoom) {
    if (appState.radarMap) {
      const zoom = typeof explicitZoom === 'number'
        ? explicitZoom
        : Math.min(Math.max(appState.radarMap.getZoom() || DEFAULT_RADAR_ZOOM, MIN_RADAR_ZOOM), MAX_RADAR_ZOOM);
      appState.radarMap.setView([lat, lon], zoom);
      if (appState.radarCityMarker) {
        appState.radarCityMarker.setLatLng([lat, lon]);
      }
      updateRadarZoomTracker();
    }
  }

  // ==========================================================================
  // TELEMETRY ACQUISITION (OPEN-METEO, CAMS AIR QUALITY & NOAA NWS)
  // ==========================================================================
  function setStationSyncState(state) {
    if (!el.stationLed) return;
    el.stationLed.classList.remove('active', 'syncing', 'error');
    el.stationLed.classList.add(state);
    document.body.classList.toggle('is-loading', state === 'syncing');
  }

  async function fetchWeatherData(loc) {
    setStationSyncState('syncing');
    el.cityName.textContent = loc.name;
    if (el.cityRegion) {
      const regionParts = [loc.state, loc.country].filter(Boolean);
      el.cityRegion.textContent = regionParts.join(', ');
    }
    el.currentDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });

    if (el.weatherStatusBanner && !appState.weather) {
      el.weatherStatusBanner.classList.remove('hidden', 'error');
      if (el.weatherStatusText) el.weatherStatusText.textContent = `Loading forecast for ${loc.name}...`;
      if (el.weatherRetryBtn) el.weatherRetryBtn.classList.add('hidden');
    }

    if (el.coordDisplay) {
      const latDir = loc.lat >= 0 ? 'N' : 'S';
      const lonDir = loc.lon >= 0 ? 'E' : 'W';
      el.coordDisplay.textContent = `${Math.abs(loc.lat).toFixed(2)}°${latDir}, ${Math.abs(loc.lon).toFixed(2)}°${lonDir}`;
    }

    if (el.nwsGovLink) {
      const govUrl = `https://forecast.weather.gov/MapClick.php?lat=${loc.lat.toFixed(4)}&lon=${loc.lon.toFixed(4)}`;
      el.nwsGovLink.href = govUrl;
      el.nwsGovLink.title = `Open official Weather.gov forecast for ${loc.name}`;
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
          el.activeSourceName.textContent = 'NOAA / NWS + Open-Meteo AQI + RainViewer';
        }
      }

      if (!data) {
        data = await omPromise;
        el.activeSourceName.textContent = 'Open-Meteo + CAMS Air Quality + RainViewer';
      }

      if (!data) throw new Error('All weather sources failed');

      appState.airQuality = await aqPromise;
      appState.weather = data;
      appState.selectedHourIdx = 0;
      appState.lastUpdatedAt = new Date();
      setStationSyncState('active');

      if (el.lastUpdatedTag) {
        el.lastUpdatedTag.textContent = `Updated ${appState.lastUpdatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }

      if (el.weatherStatusBanner) {
        el.weatherStatusBanner.classList.add('hidden');
        el.weatherStatusBanner.classList.remove('error');
      }

      renderAllWeatherData(data);
      if (appState.isAudioEnabled) {
        syncAmbientSoundscape();
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setStationSyncState('error');
      if (el.lastUpdatedTag) el.lastUpdatedTag.textContent = 'Offline';
      if (el.weatherStatusBanner) {
        el.weatherStatusBanner.classList.remove('hidden');
        el.weatherStatusBanner.classList.add('error');
        if (el.weatherStatusText) {
          el.weatherStatusText.textContent = `Unable to load live weather for ${loc.name}. Check your connection and try again.`;
        }
        if (el.weatherRetryBtn) {
          el.weatherRetryBtn.classList.remove('hidden');
        }
      }
    }
  }

  async function fetchAirQualityData(lat, lon) {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,ozone,dust,grass_pollen,birch_pollen,ragweed_pollen,alder_pollen,mugwort_pollen,olive_pollen&hourly=us_aqi,grass_pollen,birch_pollen,ragweed_pollen,alder_pollen,mugwort_pollen,olive_pollen&forecast_days=7&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = await res.json();
      const current = raw.current || {};
      const dailyByDate = {};
      if (raw.hourly && Array.isArray(raw.hourly.time)) {
        raw.hourly.time.forEach((isoStr, idx) => {
          const dayKey = isoStr.slice(0, 10);
          if (!dailyByDate[dayKey]) {
            dailyByDate[dayKey] = {
              us_aqi: null,
              grass_pollen: null,
              birch_pollen: null,
              ragweed_pollen: null,
              alder_pollen: null,
              mugwort_pollen: null,
              olive_pollen: null
            };
          }
          const bucket = dailyByDate[dayKey];
          ['us_aqi', 'grass_pollen', 'birch_pollen', 'ragweed_pollen', 'alder_pollen', 'mugwort_pollen', 'olive_pollen'].forEach(k => {
            const val = raw.hourly[k] ? raw.hourly[k][idx] : null;
            if (typeof val === 'number' && !isNaN(val)) {
              bucket[k] = bucket[k] === null ? val : Math.max(bucket[k], val);
            }
          });
        });
      }
      current._dailyByDate = dailyByDate;
      return current;
    } catch (e) {
      console.warn('Air quality fetch warning:', e);
      return null;
    }
  }

  function computeAeroallergenProfile(curWeather, aqData, lat, targetDate = new Date()) {
    const tempF = (curWeather.tempC * 9 / 5) + 32;
    const rh = curWeather.humidity || 50;
    const windMph = (curWeather.windKmh || 8) * 0.621371;
    const pop = typeof curWeather.pop === 'number' ? curWeather.pop : 0;
    const isRaining = (curWeather.weatherCode >= 51 && curWeather.weatherCode <= 82) || pop >= 65;
    const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const month = dateObj.getMonth();
    const adjMonth = lat >= 0 ? month : (month + 6) % 12;

    const rainWashout = isRaining ? 0.35 : (pop >= 40 ? 0.72 : 1.0);
    const windDispersion = Math.min(1.35, 0.8 + (windMph / 25));

    let hasLivePollen = false;

    let grassScore = 1.2;
    if (aqData && typeof aqData.grass_pollen === 'number' && aqData.grass_pollen !== null) {
      grassScore = Math.min(10, (aqData.grass_pollen / 60) * 10);
      hasLivePollen = true;
    } else {
      let seasonalBase = 1.0;
      if (adjMonth >= 4 && adjMonth <= 6) seasonalBase = 6.8;
      else if (adjMonth === 3 || adjMonth === 7) seasonalBase = 4.5;
      else if (adjMonth === 8 || adjMonth === 9) seasonalBase = 2.6;
      const tempFactor = tempF < 42 ? 0.15 : tempF > 92 ? 0.7 : 1.0;
      grassScore = seasonalBase * tempFactor * windDispersion * rainWashout;
    }

    let treeScore = 1.0;
    const rawTree = aqData && (aqData.birch_pollen !== null && aqData.birch_pollen !== undefined || aqData.alder_pollen !== null && aqData.alder_pollen !== undefined)
      ? (aqData.birch_pollen || 0) + (aqData.alder_pollen || 0) + (aqData.olive_pollen || 0)
      : null;
    if (rawTree !== null) {
      treeScore = Math.min(10, (rawTree / 120) * 10);
      hasLivePollen = true;
    } else {
      let seasonalBase = 0.8;
      if (adjMonth >= 2 && adjMonth <= 4) seasonalBase = 7.4;
      else if (adjMonth === 1 || adjMonth === 5) seasonalBase = 4.2;
      else if (adjMonth === 9) seasonalBase = 1.5;
      const tempFactor = tempF < 36 ? 0.1 : 1.0;
      treeScore = seasonalBase * tempFactor * windDispersion * rainWashout;
    }

    let weedScore = 1.5;
    const rawWeed = aqData && (aqData.ragweed_pollen !== null && aqData.ragweed_pollen !== undefined || aqData.mugwort_pollen !== null && aqData.mugwort_pollen !== undefined)
      ? (aqData.ragweed_pollen || 0) + (aqData.mugwort_pollen || 0)
      : null;
    if (rawWeed !== null) {
      weedScore = Math.min(10, (rawWeed / 80) * 10);
      hasLivePollen = true;
    } else {
      let seasonalBase = 1.0;
      if (adjMonth >= 7 && adjMonth <= 9) seasonalBase = 6.9;
      else if (adjMonth === 6 || adjMonth === 10) seasonalBase = 3.8;
      const frostKill = tempF <= 32 ? 0.1 : tempF < 50 ? 0.55 : 1.05;
      weedScore = seasonalBase * frostKill * windDispersion * rainWashout;
    }

    const humidityFactor = rh >= 80 ? 2.1 : rh >= 65 ? 1.45 : rh <= 35 ? 0.5 : 0.9;
    const autumnLeafFactor = (adjMonth >= 8 && adjMonth <= 10) ? 1.4 : 1.0;
    const rainBoost = isRaining ? 1.35 : (pop >= 45 ? 1.15 : 1.0);
    const freezeFactor = tempF < 32 ? 0.15 : 1.0;
    let moldScore = Math.min(10, 2.2 * humidityFactor * autumnLeafFactor * rainBoost * freezeFactor);

    grassScore = Math.max(0.2, Math.min(10, Number(grassScore.toFixed(1))));
    treeScore = Math.max(0.2, Math.min(10, Number(treeScore.toFixed(1))));
    weedScore = Math.max(0.2, Math.min(10, Number(weedScore.toFixed(1))));
    moldScore = Math.max(0.2, Math.min(10, Number(moldScore.toFixed(1))));

    const channels = [
      { name: 'Grass', score: grassScore },
      { name: 'Tree', score: treeScore },
      { name: 'Weed', score: weedScore },
      { name: 'Mold', score: moldScore }
    ];
    channels.sort((a, b) => b.score - a.score);
    const dominant = channels[0];
    const maxScore = dominant.score;
    let tier = 'Low';
    let statusClass = 'green';
    if (maxScore >= 6.5) {
      tier = 'High';
      statusClass = 'red';
    } else if (maxScore >= 3.5) {
      tier = 'Mod';
      statusClass = 'yellow';
    }

    const hasLiveAqi = !!(aqData && typeof aqData.us_aqi === 'number');
    const usAqi = hasLiveAqi ? Math.round(aqData.us_aqi) : 34;
    const pm25 = (aqData && typeof aqData.pm2_5 === 'number') ? aqData.pm2_5.toFixed(1) : '7.2';
    const pm10 = (aqData && typeof aqData.pm10 === 'number') ? aqData.pm10.toFixed(1) : '12.4';
    const ozone = (aqData && typeof aqData.ozone === 'number') ? Math.round(aqData.ozone) : 68;

    return {
      grassScore,
      treeScore,
      weedScore,
      moldScore,
      maxScore,
      dominantName: dominant.name,
      tier,
      statusClass,
      usAqi,
      pm25,
      pm10,
      ozone,
      hasLivePollen,
      hasLiveAqi
    };
  }

  function renderAllergyTelemetry(curWeather) {
    if (!el.pollenGrassVal) return null;
    const pet = getActiveDog();
    const profile = computeAeroallergenProfile(curWeather, appState.airQuality, appState.location.lat);

    if (el.allergyDataSourceTag) {
      if (profile.hasLivePollen && profile.hasLiveAqi) {
        el.allergyDataSourceTag.textContent = 'Live CAMS + EPA';
      } else if (profile.hasLiveAqi) {
        el.allergyDataSourceTag.textContent = 'Live EPA AQI · Est. Pollen';
      } else {
        el.allergyDataSourceTag.textContent = 'Seasonal Estimate';
      }
    }

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

    el.aqiNumVal.textContent = profile.hasLiveAqi ? `${profile.usAqi}` : `~${profile.usAqi}`;
    el.pm25Val.textContent = `${profile.pm25} µg/m³`;
    el.pm10Val.textContent = `${profile.pm10} µg/m³`;
    el.ozoneVal.textContent = `${profile.ozone} µg/m³`;

    let aqiCat = 'GOOD';
    if (profile.usAqi > 150) aqiCat = 'UNHEALTHY';
    else if (profile.usAqi > 100) aqiCat = 'SENSITIVE HAZARD';
    else if (profile.usAqi > 50) aqiCat = 'MODERATE';
    el.aqiBadge.textContent = `US AQI: ${profile.usAqi} (${aqiCat})`;

    const maxPollen = profile.maxScore;
    const isAtopicDog = pet.allergy === 'sensitive';
    const isBrachy = pet.snout === 'brachy';
    const effectivePollenRisk = maxPollen + (isAtopicDog ? 1.5 : 0);
    const effectiveAqiRisk = profile.usAqi + (isBrachy ? 20 : 0);

    let overallStatus = 'green';
    let badgeLabel = 'ALLERGY RISK: LOW';
    let shortRiskLabel = 'Low';
    let verdictTitle = 'Clean Air & Low Seasonal Pollen';
    let verdictDesc = `Air quality is ${aqiCat.toLowerCase()} (AQI ${profile.usAqi}) with minimal airborne pollen. Ideal conditions for outdoor exercise, yard work, and walking ${pet.name}.`;
    let sinusLabel = '🌬️ Sinus / Hay Fever: Low';
    let exerciseLabel = '🏃 Outdoor Exercise: Ideal';
    let canineLabel = `🐾 ${pet.name}: Standard Coat Check`;

    if (effectivePollenRisk >= 6.8 || effectiveAqiRisk >= 115) {
      overallStatus = 'red';
      badgeLabel = 'ALLERGY RISK: HIGH';
      shortRiskLabel = 'High';
      verdictTitle = 'Elevated Pollen & Particulate Advisory';
      verdictDesc = `High seasonal aeroallergen or particulate load detected. Allergy sufferers may experience sinus congestion; limit prolonged afternoon cardio and wipe ${pet.name}'s paws and coat after walks.`;
      sinusLabel = '🌬️ Sinus / Hay Fever: High';
      exerciseLabel = profile.usAqi > 100 ? '🏃 Exercise: Limit Cardio' : '🏃 Exercise: Morning Best';
      canineLabel = `🐾 ${pet.name}: Wipe Paws & Coat`;
    } else if (effectivePollenRisk >= 3.8 || effectiveAqiRisk >= 65) {
      overallStatus = 'yellow';
      badgeLabel = 'ALLERGY RISK: MODERATE';
      shortRiskLabel = 'Moderate';
      verdictTitle = 'Moderate Seasonal Pollen & Spore Activity';
      verdictDesc = `Moderate airborne pollen and mold spores present. Sensitive individuals may notice mild hay fever symptoms on breezy afternoons. Quick paw rinse advised for ${pet.name} after grassy walks.`;
      sinusLabel = '🌬️ Sinus / Hay Fever: Moderate';
      exerciseLabel = '🏃 Outdoor Exercise: Good';
      canineLabel = `🐾 ${pet.name}: Rinse Paws if Itchy`;
    }

    // Update Hero Real-Time Allergy Bar
    if (el.heroAllergyPill) {
      el.heroAllergyPill.textContent = `🌿 Allergy: ${shortRiskLabel} (${profile.maxScore.toFixed(1)}/10)`;
      el.heroAllergyPill.className = `hero-allergy-pill ${overallStatus === 'green' ? '' : overallStatus}`.trim();
    }
    if (el.heroDominantPollen) {
      el.heroDominantPollen.textContent = `Top: ${profile.dominantName} (${profile.maxScore.toFixed(1)})`;
    }
    if (el.heroAqiPill) {
      const aqiShort = profile.usAqi <= 50 ? 'Good' : profile.usAqi <= 100 ? 'Mod' : 'High';
      el.heroAqiPill.textContent = `AQI ${profile.usAqi} · ${aqiShort}`;
    }

    el.allergyOverallBadge.textContent = badgeLabel;
    el.allergyProtocolCard.className = `allergy-protocol-card status-${overallStatus}`;
    el.allergyOverallBadge.className = `status-pill status-${overallStatus}`;
    el.allergyOverallBadge.removeAttribute('style');

    el.allergyVerdictTitle.textContent = verdictTitle;
    el.allergyVerdictDesc.textContent = verdictDesc;
    if (el.symptomWatchRow) {
      el.symptomWatchRow.innerHTML = `
        <span class="symptom-chip">${escapeHtml(sinusLabel)}</span>
        <span class="symptom-chip">${escapeHtml(exerciseLabel)}</span>
        <span class="symptom-chip">${escapeHtml(canineLabel)}</span>
      `;
    }

    return { profile, overallStatus };
  }

  async function fetchOpenMeteoData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,weather_code,surface_pressure,wind_speed_10m,uv_index,visibility,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset&forecast_days=8&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo failed');
    return parseOpenMeteoPayload(await res.json());
  }

  function parseOpenMeteoPayload(raw) {
    const cur = raw.current;
    const h = raw.hourly;
    const d = raw.daily;

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

    const todayStr = new Date().toLocaleDateString('en-CA');
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
        headers: { 'User-Agent': 'PawCastFieldStation/6.0' }
      });
      if (!pointRes.ok) return null;
      const pointData = await pointRes.json();

      const hRes = await fetch(pointData.properties.forecastHourly, {
        headers: { 'User-Agent': 'PawCastFieldStation/6.0' }
      });
      if (!hRes.ok) return null;
      const hData = await hRes.json();

      const periods = hData.properties.periods;
      if (!periods || !periods.length) return null;

      const first = periods[0];
      const tempC = (first.temperature - 32) * 5 / 9;

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

      const curWindKmh = parseWindSpeedKmh(first.windSpeed);
      return {
        current: {
          tempC,
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
        hourly: allHourly.slice(0, 24),
        daily: buildDailyFromHourly(allHourly)
      };
    } catch (e) {
      return null;
    }
  }

  // ==========================================================================
  // UNIT FORMATTING & THERMODYNAMIC GROUND SURFACE MODEL
  // ==========================================================================
  function fmtTempF(tempF, showUnit = true) {
    if (appState.units === 'imperial') {
      return `${Math.round(tempF)}°${showUnit ? 'F' : ''}`;
    }
    return `${Math.round((tempF - 32) * 5 / 9)}°${showUnit ? 'C' : ''}`;
  }

  function fmtTempC(tempC, showUnit = true) {
    if (appState.units === 'imperial') {
      return `${Math.round((tempC * 9 / 5) + 32)}°${showUnit ? 'F' : ''}`;
    }
    return `${Math.round(tempC)}°${showUnit ? 'C' : ''}`;
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
    const asphaltF = Math.round(Math.max(tempF, tempF + Math.max(0, asphaltAdd)));
    // Accurate grass temp even in sub-freezing winter conditions
    const grassF = Math.round(tempF - (isDay ? 2 : 4));

    return {
      asphaltF,
      asphaltC: Math.round((asphaltF - 32) * 5 / 9),
      grassF,
      grassC: Math.round((grassF - 32) * 5 / 9),
      solarMultiplier: solarHeatMultiplier
    };
  }

  function calculateDualSafetyIndex(tempC, humidity, windKmh, isDay = true, uv = 3, petOverride = null) {
    const tempF = (tempC * 9 / 5) + 32;
    const windMph = windKmh * 0.621371;
    const pet = petOverride || getActiveDog();
    const surfaces = calculateSurfaceTemps(tempF, isDay, uv, windMph);

    const aspDisp = fmtTempF(surfaces.asphaltF, true);
    const grsDisp = fmtTempF(surfaces.grassF, true);
    const airDisp = fmtTempF(tempF, true);

    let pawStatus = 'green';
    let pawPill = 'PAWS SAFE';
    let pawTitle = 'All Surfaces Safe';
    let pawDesc = `Asphalt (~${aspDisp}) and lawn turf (~${grsDisp}) are comfortable for walking ${pet.name}.`;

    if (surfaces.asphaltF >= 125) {
      pawStatus = 'red';
      pawPill = 'HOT ASPHALT';
      pawTitle = 'Asphalt Paw Burn Hazard';
      pawDesc = `Blacktop is ~${aspDisp} in direct sun. Walk ${pet.name} on natural grass (~${grsDisp}) or shaded paths.`;
    } else if (surfaces.asphaltF >= 105) {
      pawStatus = 'yellow';
      pawPill = 'WARM PAVEMENT';
      pawTitle = 'Warm Blacktop Surface';
      pawDesc = `Asphalt is warming (~${aspDisp}). Prefer grassy park strips (~${grsDisp}) for ${pet.name}.`;
    }

    if (tempF < 32) {
      if (tempF < 20) {
        pawStatus = 'red';
        pawPill = 'FREEZE HAZARD';
        pawTitle = 'Sub-Freezing Ground & Salt';
        pawDesc = `Frigid pavement (~${aspDisp}) and road de-icers. Winter booties or a coat advised for ${pet.name}.`;
      } else {
        pawStatus = 'yellow';
        pawPill = 'CHILLY GROUND';
        pawTitle = 'Frosty Pavement & Salt Watch';
        pawDesc = `Near-freezing ground (~${aspDisp}). Wipe ${pet.name}'s paws after walks if sidewalks are salted.`;
      }
    }

    let heatSensitivityOffset = 0;
    if (pet.snout === 'brachy') heatSensitivityOffset += 5;
    if (pet.coat === 'double' || pet.coat === 'dark') heatSensitivityOffset += 3;
    if (pet.size === 'small' || pet.size === 'large') heatSensitivityOffset += 2;
    if (pet.age === 'senior' || pet.age === 'puppy') heatSensitivityOffset += 2;

    const heatIndexF = tempF + (humidity > 60 ? (humidity - 60) * 0.15 : 0);
    const adjustedHeatIndex = heatIndexF + heatSensitivityOffset;
    const heatIdxDisp = fmtTempF(heatIndexF, true);

    let heatStatus = 'green';
    let heatPill = 'COMFORTABLE';
    let heatTitle = 'Pleasant Outdoor Weather';
    let heatDesc = `Comfortable air mass (${airDisp}, ${humidity}% RH) for outdoor activities, recreation, and walking.`;

    if (tempF >= 90 || adjustedHeatIndex >= 94) {
      heatStatus = 'red';
      heatPill = 'HEAT ADVISORY';
      heatTitle = 'High Heat & Humidity Load';
      heatDesc = `Hot thermal index (${heatIdxDisp}). Stay hydrated, seek shade midday, and keep ${pet.name}'s walks brief.`;
    } else if (tempF >= 80 || adjustedHeatIndex >= 83) {
      heatStatus = 'yellow';
      heatPill = 'WARM & HUMID';
      heatTitle = 'Warm Outdoor Conditions';
      heatDesc = `Warm air (${airDisp}). Bring water for extended outdoor exercise or walks with ${pet.name}.`;
    } else if (tempF < 32) {
      heatStatus = 'yellow';
      heatPill = 'FREEZING';
      heatTitle = 'Below-Freezing Temperatures';
      heatDesc = `Sub-freezing air (${airDisp}). Dress in warm layers and watch for icy patches.`;
    } else if (tempF < 48) {
      heatStatus = 'green';
      heatPill = 'CRISP / BRISK';
      heatTitle = 'Crisp Jacket Weather';
      heatDesc = `Cool, refreshing conditions (${airDisp}). Light jacket recommended; great cooling weather for ${pet.name}.`;
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

  function statusRank(s) {
    return s === 'red' ? 2 : s === 'yellow' ? 1 : 0;
  }

  // ==========================================================================
  // RENDER TELEMETRY TO INSTRUMENT PANELS
  // ==========================================================================
  function renderAllWeatherData(data) {
    const isImp = appState.units === 'imperial';
    const cur = data.current;
    const pet = getActiveDog();
    const todayDaily = data.daily[0] || {};
    const condition = getWeatherConditionInfo(cur.weatherCode, cur.isDay);

    // Weather-aware subtle ambient theme
    document.body.classList.remove('theme-default', 'theme-sunny', 'theme-rainy', 'theme-snowy');
    document.body.classList.add(`theme-${condition.theme}`);
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

    el.currentTemp.textContent = `${mainTemp}°`;
    if (el.heroFeelsInline) el.heroFeelsInline.textContent = `Feels ${feelsTemp}${unitSym}`;
    el.tempHigh.textContent = `HIGH ${highDisp}°`;
    el.tempLow.textContent = `LOW ${lowDisp}°`;
    el.weatherConditionText.textContent = condition.label.toUpperCase();
    el.weatherMainEmoji.textContent = condition.emoji;
    el.weatherMainEmoji.title = `${condition.label}: ${condition.detail}`;

    const safety = calculateDualSafetyIndex(cur.tempC, cur.humidity, cur.windKmh, cur.isDay, cur.uv);

    // Card 1: Today's Weather Summary
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
    if (el.heroVisVal) el.heroVisVal.textContent = visStr;
    if (el.heroMoonVal) el.heroMoonVal.textContent = getLunarPhase();

    // Update Dynamic Thermal Scale Labels (°F / °C)
    if (el.scaleLblFreeze) {
      el.scaleLblFreeze.textContent = isImp ? '32°F Freeze' : '0°C Freeze';
      el.scaleLblIdeal.textContent = isImp ? '85°F Ideal' : '29°C Ideal';
      el.scaleLblWarm.textContent = isImp ? '105°F Warm' : '41°C Warm';
      el.scaleLblHot.textContent = isImp ? '125°F+ Hot' : '52°C+ Hot';
    }

    // Card 2: Dog Walk & Pavement Check
    el.boxPawSafety.className = `instrument-gauge status-${safety.pawStatus}`;
    if (el.pawStatusPill) el.pawStatusPill.textContent = safety.pawPill;
    el.pawStatusTitle.textContent = safety.pawTitle;
    el.pawSafetyDesc.textContent = safety.pawDesc;
    el.asphaltTempVal.textContent = fmtTempF(safety.surfaces.asphaltF, true);
    el.asphaltTempVal.className = `surf-mono-val ${safety.pawStatus === 'red' ? 'danger-text' : safety.pawStatus === 'yellow' ? 'warn-text' : ''}`.trim();
    el.grassTempVal.textContent = fmtTempF(safety.surfaces.grassF, true);
    el.grassTempVal.className = `surf-mono-val ${safety.surfaces.grassF < 25 ? 'warn-text' : 'safe-text'}`;

    if (el.subjectCoatVal) el.subjectCoatVal.textContent = `🐾 ${pet.name} · ${capitalize(pet.coat)} Coat`;
    if (el.weeklyPackTag) el.weeklyPackTag.textContent = `🌿 Daily Pollen & 🐾 Walk tags for: ${pet.name}`;

    if (el.pawThermalNeedle) {
      const clampedF = Math.max(25, Math.min(145, safety.surfaces.asphaltF));
      const pct = ((clampedF - 25) / (145 - 25)) * 92 + 4;
      el.pawThermalNeedle.style.left = `${pct.toFixed(1)}%`;
      if (el.pawThermalTrack) {
        el.pawThermalTrack.setAttribute('aria-label', `Estimated pavement temperature: ${fmtTempF(safety.surfaces.asphaltF, true)} (${safety.pawTitle})`);
      }
    }

    // Render Air Quality first so we can feed allergy status into Walk Checklist & Cross-Pack Alert
    const allergyResult = renderAllergyTelemetry(cur);
    renderWalkChecklist(cur, safety, pet, allergyResult);
    renderCrossPackAdvisory(cur, safety, pet, allergyResult);

    // Detailed Weather Metrics
    el.metricPop.textContent = `${cur.pop}%`;
    if (el.barPop) el.barPop.style.width = `${Math.min(100, cur.pop)}%`;
    const todayPrecipMm = todayDaily.precipSumMm || cur.precipMm || 0;
    if (el.metricPrecipSub) {
      const precipDisp = isImp ? `${(todayPrecipMm / 25.4).toFixed(2)} in` : `${todayPrecipMm.toFixed(1)} mm`;
      el.metricPrecipSub.textContent = `${precipDisp} expected today`;
    }

    el.metricWind.textContent = `${windSpeedStr} ${compassDir}`;
    if (el.metricGustSub) el.metricGustSub.textContent = `Gusts to ${gustSpeedVal} ${speedUnit}`;

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
    if (el.metricVisSub) el.metricVisSub.textContent = `Visibility: ${visStr}`;

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
  }

  function renderWalkChecklist(cur, safety, pet, allergyResult) {
    if (!el.walkChecklistRow) return;
    const chips = [];

    if (safety.surfaces.asphaltF >= 125) {
      chips.push({ text: '🌿 Grass / Shade Only', cls: 'danger' });
      chips.push({ text: '✋ 7-Sec Hand Test', cls: 'danger' });
    } else if (safety.surfaces.asphaltF >= 105) {
      chips.push({ text: '🌿 Prefer Grass Strips', cls: 'warn' });
    }

    if (safety.heatStatus === 'red' || (pet.snout === 'brachy' && safety.tempF >= 78)) {
      chips.push({ text: '⏱️ Brief Walk', cls: 'danger' });
      chips.push({ text: '💧 Bring Water', cls: 'warn' });
    } else if (safety.heatStatus === 'yellow' || safety.tempF >= 74) {
      chips.push({ text: '💧 Bring Water', cls: 'warn' });
    }

    if (safety.tempF < 36 && (pet.size === 'small' || pet.coat === 'short' || pet.coat === 'hairless' || pet.age !== 'adult')) {
      chips.push({ text: '🧥 Coat Advised', cls: 'warn' });
    }
    if (safety.tempF < 32) {
      chips.push({ text: '🧂 Wipe Salt After', cls: 'warn' });
    }

    if (cur.pop >= 50 || (cur.weatherCode >= 51 && cur.weatherCode <= 82)) {
      chips.push({ text: '☔ Towel Ready', cls: '' });
    }

    if (allergyResult && (allergyResult.overallStatus === 'red' || (allergyResult.overallStatus === 'yellow' && pet.allergy === 'sensitive'))) {
      chips.push({ text: '🧼 Wipe Paws (Pollen)', cls: 'warn' });
    }

    if (cur.uv >= 6 && pet.coat === 'hairless') {
      chips.push({ text: '☀️ Pet-Safe SPF', cls: 'warn' });
    }

    if (chips.length === 0) {
      chips.push({ text: '✓ Standard Leash Walk', cls: '' });
      chips.push({ text: '💧 Fresh Water Home', cls: '' });
    }

    el.walkChecklistRow.innerHTML = chips.slice(0, 4).map(c =>
      `<span class="checklist-chip ${c.cls}">${escapeHtml(c.text)}</span>`
    ).join('');
  }

  function renderCrossPackAdvisory(cur, activeSafety, activePet, allergyResult) {
    if (!el.packAdvisoryBanner) return;
    if (appState.dogs.length <= 1) {
      el.packAdvisoryBanner.classList.add('hidden');
      return;
    }

    const activeRisk = Math.max(statusRank(activeSafety.pawStatus), statusRank(activeSafety.heatStatus));
    let stricterDog = null;
    let stricterReason = '';

    for (const dog of appState.dogs) {
      if (dog.id === activePet.id) continue;
      const dSafety = calculateDualSafetyIndex(cur.tempC, cur.humidity, cur.windKmh, cur.isDay, cur.uv, dog);
      const dRisk = Math.max(statusRank(dSafety.pawStatus), statusRank(dSafety.heatStatus));
      const allergyExtra = allergyResult && dog.allergy === 'sensitive' && activePet.allergy !== 'sensitive' && allergyResult.profile.maxScore >= 3.5;

      if (dRisk > activeRisk) {
        stricterDog = dog;
        stricterReason = dSafety.heatStatus === 'red' ? 'higher heat sensitivity' : 'stricter weather caution';
        break;
      } else if (allergyExtra) {
        stricterDog = dog;
        stricterReason = 'pollen sensitivity today';
      }
    }

    if (stricterDog) {
      el.packAdvisoryBanner.classList.remove('hidden');
      el.packAdvisoryBanner.textContent = `⚠️ Pack Note: ${stricterDog.name} has ${stricterReason} — click to switch profile →`;
      el.packAdvisoryBanner.onclick = () => {
        playHardwareClick(720);
        setActiveDog(stricterDog.id);
      };
    } else {
      el.packAdvisoryBanner.classList.add('hidden');
    }
  }

  // ==========================================================================
  // INTERACTIVE 7-DAY WEATHER FORECAST + TEMP RANGE BARS + DAY DETAIL DRAWER
  // ==========================================================================
  function renderDailyForecast(daily) {
    const isImp = appState.units === 'imperial';
    const pet = getActiveDog();
    el.dailyList.innerHTML = '';

    const sevenDays = [...daily];
    while (sevenDays.length > 0 && sevenDays.length < 7) {
      const last = sevenDays[sevenDays.length - 1];
      sevenDays.push({ ...last, date: new Date(last.date.getTime() + 86400000) });
    }
    const slice7 = sevenDays.slice(0, 7);

    // Compute weekly temperature spread for proportional range bars
    const allLows = slice7.map(d => d.minTempC);
    const allHighs = slice7.map(d => d.maxTempC);
    const weekMin = Math.min(...allLows);
    const weekMax = Math.max(...allHighs);
    const weekSpan = Math.max(1, weekMax - weekMin);

    const enrichedDays = [];

    slice7.forEach((d, i) => {
      const dayName = i === 0 ? 'TODAY' : d.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const fullDayName = i === 0 ? 'Today' : d.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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

      const yyyy = d.date.getFullYear();
      const mm = String(d.date.getMonth() + 1).padStart(2, '0');
      const dd = String(d.date.getDate()).padStart(2, '0');
      const dayIsoKey = `${yyyy}-${mm}-${dd}`;
      const dailyAqBucket = (appState.airQuality && appState.airQuality._dailyByDate && appState.airQuality._dailyByDate[dayIsoKey])
        ? appState.airQuality._dailyByDate[dayIsoKey]
        : (i === 0 ? appState.airQuality : null);
      const estHumidity = d.pop >= 65 ? 78 : d.pop >= 35 ? 62 : 48;
      const dayAllergy = computeAeroallergenProfile({
        tempC: d.maxTempC,
        humidity: estHumidity,
        windKmh: d.maxWindKmh || 12,
        weatherCode: d.weatherCode,
        pop: d.pop
      }, dailyAqBucket, appState.location.lat, d.date);

      const isAtopicDog = pet.allergy === 'sensitive';
      const adjDayPollenScore = Math.min(10, dayAllergy.maxScore + (isAtopicDog ? 1.0 : 0));
      let allergyStatus = dayAllergy.statusClass;
      let allergyTier = dayAllergy.tier;
      if (adjDayPollenScore >= 6.5) {
        allergyStatus = 'red';
        allergyTier = 'High';
      } else if (adjDayPollenScore >= 3.5) {
        allergyStatus = 'yellow';
        allergyTier = 'Mod';
      }

      const leftPct = ((d.minTempC - weekMin) / weekSpan) * 100;
      const widthPct = Math.max(12, ((d.maxTempC - d.minTempC) / weekSpan) * 100);

      enrichedDays.push({
        day: d,
        idx: i,
        dayName,
        fullDayName,
        dateSub,
        cond,
        maxT,
        minT,
        windVal,
        windUnit,
        saf,
        overallStatus,
        statusText,
        dayAllergy,
        allergyStatus,
        allergyTier
      });

      const isSelected = appState.selectedDayIdx === i;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `week-day-card ${i === 0 ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`;
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      card.setAttribute('aria-expanded', isSelected ? 'true' : 'false');
      card.innerHTML = `
        <div class="wk-day-top">
          <span class="wk-day-name">${dayName}</span>
          <span class="wk-day-date">${dateSub}</span>
        </div>
        <span class="wk-day-emoji" aria-hidden="true">${cond.emoji}</span>
        <span class="wk-cond-label">${escapeHtml(cond.label)}</span>
        <div class="wk-temp-pair">
          <span class="wk-high">${maxT}°</span>
          <span class="wk-low">${minT}°</span>
        </div>
        <div class="wk-range-track" aria-hidden="true">
          <div class="wk-range-fill" style="left: ${leftPct.toFixed(1)}%; width: ${widthPct.toFixed(1)}%;"></div>
        </div>
        <div class="wk-meta-row">
          <span class="wk-pop">💧 ${d.pop}%</span>
          <span class="wk-wind">💨 ${windVal}${isImp ? 'm' : 'k'}</span>
        </div>
        <span class="wk-allergy-pill ${allergyStatus}">🌿 ${allergyTier} · ${dayAllergy.dominantName}</span>
        <span class="wk-paw-pill ${overallStatus}">${escapeHtml(statusText)}</span>
      `;

      card.addEventListener('click', () => {
        playHardwareClick(690);
        appState.selectedDayIdx = appState.selectedDayIdx === i ? null : i;
        renderDailyForecast(daily);
      });

      el.dailyList.appendChild(card);
    });

    if (appState.selectedDayIdx !== null && enrichedDays[appState.selectedDayIdx]) {
      renderDayDetailDrawer(enrichedDays[appState.selectedDayIdx]);
    } else {
      closeDayDetailDrawer(true);
    }
  }

  function renderDayDetailDrawer(item) {
    if (!el.dayDetailDrawer) return;
    const isImp = appState.units === 'imperial';
    const pet = getActiveDog();
    const unitSym = isImp ? '°F' : '°C';
    const precipMm = item.day.precipSumMm || 0;
    const precipStr = isImp ? `${(precipMm / 25.4).toFixed(2)} in` : `${precipMm.toFixed(1)} mm`;
    const sunStr = item.day.sunrise && item.day.sunset ? formatSunTimes(item.day.sunrise, item.day.sunset) : 'Standard';

    const barCls = (score) => score >= 6.5 ? 'danger' : score >= 3.5 ? 'caution' : 'safe';

    el.dayDetailDrawer.classList.remove('hidden');
    el.dayDetailDrawer.innerHTML = `
      <div class="day-detail-top">
        <div class="day-detail-title-wrap">
          <span class="day-detail-emoji" aria-hidden="true">${item.cond.emoji}</span>
          <div>
            <h3 class="day-detail-heading">${escapeHtml(item.fullDayName)} — ${escapeHtml(item.cond.label)}</h3>
            <span class="day-detail-sub">${escapeHtml(item.cond.detail)}</span>
          </div>
        </div>
        <button type="button" id="close-day-detail-btn" class="hw-btn secondary sm-btn">Close Details ✕</button>
      </div>

      <div class="day-detail-grid">
        <div class="day-detail-metrics">
          <div class="resp-cell">
            <span class="resp-label">High / Low</span>
            <strong class="resp-val">${item.maxT}${unitSym} / ${item.minT}${unitSym}</strong>
          </div>
          <div class="resp-cell">
            <span class="resp-label">Rain &amp; Volume</span>
            <strong class="resp-val">${item.day.pop}% · ${precipStr}</strong>
          </div>
          <div class="resp-cell">
            <span class="resp-label">Peak Wind</span>
            <strong class="resp-val">${item.windVal} ${item.windUnit}</strong>
          </div>
          <div class="resp-cell">
            <span class="resp-label">Peak UV</span>
            <strong class="resp-val">${item.day.uv} (${getUvCategory(item.day.uv)})</strong>
          </div>
          <div class="resp-cell">
            <span class="resp-label">Peak Pavement</span>
            <strong class="resp-val">${fmtTempF(item.saf.surfaces.asphaltF, true)}</strong>
          </div>
          <div class="resp-cell">
            <span class="resp-label">Sunrise / Sunset</span>
            <strong class="resp-val">${sunStr}</strong>
          </div>
        </div>

        <div class="day-detail-pollen-box">
          <span class="mono-label">🌿 Daily Pollen &amp; Mold Outlook (Top: ${item.dayAllergy.dominantName})</span>
          <div class="mini-pollen-grid">
            <div class="mini-pollen-item">
              <div class="mini-pollen-head"><span>Grass</span><strong>${item.dayAllergy.grassScore}/10</strong></div>
              <div class="allergen-bar-track"><div class="allergen-bar-fill ${barCls(item.dayAllergy.grassScore)}" style="width:${item.dayAllergy.grassScore * 10}%"></div></div>
            </div>
            <div class="mini-pollen-item">
              <div class="mini-pollen-head"><span>Tree</span><strong>${item.dayAllergy.treeScore}/10</strong></div>
              <div class="allergen-bar-track"><div class="allergen-bar-fill ${barCls(item.dayAllergy.treeScore)}" style="width:${item.dayAllergy.treeScore * 10}%"></div></div>
            </div>
            <div class="mini-pollen-item">
              <div class="mini-pollen-head"><span>Weed</span><strong>${item.dayAllergy.weedScore}/10</strong></div>
              <div class="allergen-bar-track"><div class="allergen-bar-fill ${barCls(item.dayAllergy.weedScore)}" style="width:${item.dayAllergy.weedScore * 10}%"></div></div>
            </div>
            <div class="mini-pollen-item">
              <div class="mini-pollen-head"><span>Mold</span><strong>${item.dayAllergy.moldScore}/10</strong></div>
              <div class="allergen-bar-track"><div class="allergen-bar-fill ${barCls(item.dayAllergy.moldScore)}" style="width:${item.dayAllergy.moldScore * 10}%"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="day-detail-advisory">
        <strong>🐾 Walk Forecast for ${escapeHtml(pet.name)}:</strong> ${escapeHtml(item.saf.pawDesc)}
      </div>
    `;

    const closeBtn = document.getElementById('close-day-detail-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        playHardwareClick(560);
        closeDayDetailDrawer();
      });
    }
  }

  function closeDayDetailDrawer(skipRerender = false) {
    appState.selectedDayIdx = null;
    if (el.dayDetailDrawer) el.dayDetailDrawer.classList.add('hidden');
    if (!skipRerender && appState.weather) {
      renderDailyForecast(appState.weather.daily);
    }
  }

  // ==========================================================================
  // INTERACTIVE 24-HOUR SVG CHART + SYNCHRONIZED HOURLY INSPECTOR
  // ==========================================================================
  function renderHourlyForecast(hourly) {
    if (!hourly || !hourly.length) return;
    const isImp = appState.units === 'imperial';
    el.hourlyScroller.innerHTML = '';

    const temps = hourly.map(h => isImp ? (h.tempC * 9 / 5) + 32 : h.tempC);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const rangeT = maxT - minT || 1;

    const svg = el.hourlySvg;
    svg.innerHTML = '';
    const width = 1000;
    const height = 205;
    const chartTop = 28;
    const chartBottom = 166;
    const points = [];

    // Defs: Warm gradient fill under temperature curve
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E56B25" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#E56B25" stop-opacity="0.01" />
      </linearGradient>
    `;
    svg.appendChild(defs);

    hourly.forEach((h, i) => {
      const x = hourly.length > 1 ? (i / (hourly.length - 1)) * (width - 64) + 32 : width / 2;
      const val = isImp ? (h.tempC * 9 / 5) + 32 : h.tempC;
      const y = chartBottom - ((val - minT) / rangeT) * (chartBottom - chartTop);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const timeStr = i === 0 ? 'NOW' : h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
      points.push({ x, y, val, pop: h.pop, safety: saf, timeStr, idx: i, raw: h });
    });

    // Subtle baseline
    const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    baseLine.setAttribute('x1', '20');
    baseLine.setAttribute('x2', String(width - 20));
    baseLine.setAttribute('y1', String(chartBottom + 6));
    baseLine.setAttribute('y2', String(chartBottom + 6));
    baseLine.setAttribute('stroke', 'rgba(235, 230, 218, 0.14)');
    baseLine.setAttribute('stroke-width', '1');
    svg.appendChild(baseLine);

    // Rain probability bars
    points.forEach(p => {
      if (p.pop > 0) {
        const barH = (p.pop / 100) * 62;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(p.x - 9));
        rect.setAttribute('y', String(chartBottom + 5 - barH));
        rect.setAttribute('width', '18');
        rect.setAttribute('height', String(barH));
        rect.setAttribute('fill', 'rgba(56, 189, 248, 0.24)');
        rect.setAttribute('rx', '2');
        svg.appendChild(rect);
      }
    });

    // Smooth Bezier curve + area fill
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      pathD += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', `${pathD} L ${points[points.length - 1].x} ${chartBottom + 5} L ${points[0].x} ${chartBottom + 5} Z`);
    areaPath.setAttribute('fill', 'url(#tempAreaGrad)');
    svg.appendChild(areaPath);

    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.setAttribute('d', pathD);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', '#E56B25');
    linePath.setAttribute('stroke-width', '2.5');
    svg.appendChild(linePath);

    // Selected vertical guide line
    const selPt = points[appState.selectedHourIdx] || points[0];
    const selGuide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    selGuide.setAttribute('x1', String(selPt.x));
    selGuide.setAttribute('x2', String(selPt.x));
    selGuide.setAttribute('y1', String(chartTop - 10));
    selGuide.setAttribute('y2', String(chartBottom + 6));
    selGuide.setAttribute('stroke', 'rgba(229, 107, 37, 0.55)');
    selGuide.setAttribute('stroke-dasharray', '3 3');
    selGuide.setAttribute('stroke-width', '1.5');
    svg.appendChild(selGuide);

    // Interactive Data Nodes & Labels
    points.forEach((p, i) => {
      const isSelected = i === appState.selectedHourIdx;
      let dotColor = '#22C55E';
      if (p.safety.pawStatus === 'yellow' || p.safety.heatStatus === 'yellow') dotColor = '#EAB308';
      if (p.safety.pawStatus === 'red' || p.safety.heatStatus === 'red') dotColor = '#EF4444';

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'svg-hour-hit');
      g.addEventListener('click', () => {
        playHardwareClick(680);
        selectHourIndex(i, false);
      });

      if (isSelected) {
        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', String(p.x));
        halo.setAttribute('cy', String(p.y));
        halo.setAttribute('r', '10');
        halo.setAttribute('fill', 'rgba(229, 107, 37, 0.25)');
        halo.setAttribute('stroke', '#E56B25');
        halo.setAttribute('stroke-width', '1.5');
        g.appendChild(halo);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', isSelected ? '6' : '4.5');
      circle.setAttribute('fill', dotColor);
      circle.setAttribute('stroke', '#0D0F11');
      circle.setAttribute('stroke-width', '2');

      const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleEl.textContent = `${p.timeStr} · ${Math.round(p.val)}° · Rain ${p.pop}% · Pavement ~${fmtTempF(p.safety.surfaces.asphaltF, true)}`;
      circle.appendChild(titleEl);
      g.appendChild(circle);

      // Transparent wider hit target for effortless clicking
      const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hitRect.setAttribute('x', String(p.x - 16));
      hitRect.setAttribute('y', '0');
      hitRect.setAttribute('width', '32');
      hitRect.setAttribute('height', String(height));
      hitRect.setAttribute('fill', 'transparent');
      g.appendChild(hitRect);

      if (i % 2 === 0 || isSelected) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(p.x));
        text.setAttribute('y', String(p.y - 12));
        text.setAttribute('fill', isSelected ? '#FDBA74' : '#F2EFE9');
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.setAttribute('font-size', isSelected ? '13' : '11.5');
        text.setAttribute('font-weight', isSelected ? '700' : '500');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = `${Math.round(p.val)}°`;
        g.appendChild(text);
      }

      if (i % 3 === 0 || i === points.length - 1) {
        const timeTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        timeTxt.setAttribute('x', String(p.x));
        timeTxt.setAttribute('y', String(height - 10));
        timeTxt.setAttribute('fill', isSelected ? '#FDBA74' : '#A3A096');
        timeTxt.setAttribute('font-family', 'JetBrains Mono, monospace');
        timeTxt.setAttribute('font-size', '11');
        timeTxt.setAttribute('text-anchor', 'middle');
        timeTxt.textContent = p.timeStr;
        g.appendChild(timeTxt);
      }

      svg.appendChild(g);
    });

    // Render Interactive Hour Cards
    hourly.forEach((h, idx) => {
      const tVal = isImp ? Math.round((h.tempC * 9 / 5) + 32) : Math.round(h.tempC);
      const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
      const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
      const timeStr = idx === 0 ? 'NOW' : h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const overallStatus = saf.pawStatus === 'red' || saf.heatStatus === 'red' ? 'red' :
                            saf.pawStatus === 'yellow' || saf.heatStatus === 'yellow' ? 'yellow' : 'green';
      const statusLabel = h.pop >= 50 ? `💧 ${h.pop}%` : (overallStatus === 'green' ? 'Ideal' : overallStatus === 'yellow' ? 'Caution' : 'Alert');
      const isSelected = idx === appState.selectedHourIdx;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `hour-card ${isSelected ? 'is-selected' : ''}`;
      card.dataset.hourIdx = String(idx);
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      card.innerHTML = `
        <span class="hour-time">${timeStr}</span>
        <span class="hour-emoji" aria-hidden="true">${cond.emoji}</span>
        <span class="hour-temp">${tVal}°</span>
        <span class="hour-paw-badge ${overallStatus}">${escapeHtml(statusLabel)}</span>
      `;
      card.addEventListener('click', () => {
        playHardwareClick(660);
        selectHourIndex(idx, false);
      });
      el.hourlyScroller.appendChild(card);
    });

    updateHourInspector(hourly[appState.selectedHourIdx] || hourly[0], appState.selectedHourIdx);
  }

  function selectHourIndex(idx, scrollIntoView = false) {
    if (!appState.weather || !appState.weather.hourly[idx]) return;
    appState.selectedHourIdx = idx;
    renderHourlyForecast(appState.weather.hourly);
    if (scrollIntoView) {
      const section = document.getElementById('section-hourly');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const targetCard = el.hourlyScroller.querySelector(`.hour-card[data-hour-idx="${idx}"]`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  function updateHourInspector(h, idx) {
    if (!h || !el.inspTime) return;
    const isImp = appState.units === 'imperial';
    const cond = getWeatherConditionInfo(h.weatherCode, h.isDay);
    const saf = calculateDualSafetyIndex(h.tempC, h.humidity, h.windKmh, h.isDay, h.uv);
    const timeStr = idx === 0 ? 'NOW' : h.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const windVal = isImp ? Math.round(h.windKmh * 0.621371) : Math.round(h.windKmh);

    el.inspTime.textContent = timeStr;
    el.inspCond.textContent = `${cond.emoji} ${cond.label} · ${saf.pawTitle}`;
    el.inspAir.textContent = fmtTempC(h.tempC, true);
    el.inspFeels.textContent = fmtTempC(h.feelsC, true);
    el.inspPavement.textContent = `~${fmtTempF(saf.surfaces.asphaltF, true)}`;
    el.inspRain.textContent = `${h.pop}%`;
    el.inspWind.textContent = `${windVal} ${isImp ? 'mph' : 'km/h'}`;
    el.inspUv.textContent = `${h.uv} (${getUvCategory(h.uv)})`;
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
          idx,
          timeStr: `${timeLabel} · ${tVal}° ${cond.emoji}`,
          status: 'best',
          label: 'Ideal Outdoors & Walk'
        });
      } else if (isModerate) {
        windows.push({
          idx,
          timeStr: `${timeLabel} · ${tVal}° ${cond.emoji}`,
          status: 'caution',
          label: saf.pawStatus === 'yellow' ? 'Shade / Grass Advised' : 'Fair Conditions'
        });
      }
    });

    const displayWindows = windows.slice(0, 5);
    if (displayWindows.length === 0) {
      el.walkWindowsGrid.innerHTML = `
        <div class="window-card caution" style="cursor:default;">
          <span class="window-time">Weather Advisory</span>
          <span class="window-tag">Plan outdoor activities for early morning or evening hours</span>
        </div>
      `;
      return;
    }

    displayWindows.forEach(w => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `window-card ${w.status}`;
      btn.title = `Jump to ${w.timeStr} in 24-Hour Outlook`;
      btn.innerHTML = `
        <span class="window-time">${escapeHtml(w.timeStr)}</span>
        <span class="window-tag">${escapeHtml(w.label)}</span>
      `;
      btn.addEventListener('click', () => {
        playHardwareClick(720);
        selectHourIndex(w.idx, true);
      });
      el.walkWindowsGrid.appendChild(btn);
    });
  }

  // ==========================================================================
  // GEOCODING, REVERSE GPS GEOCODING, UNITS & FAVORITES (WITH UNDO)
  // ==========================================================================
  function closeSearchDropdown() {
    el.searchResults.classList.add('hidden');
    el.locationInput.setAttribute('aria-expanded', 'false');
    el.locationInput.setAttribute('aria-activedescendant', '');
    appState.searchActiveIdx = -1;
  }

  function updateSearchActiveHighlight() {
    const items = el.searchResults.querySelectorAll('.search-result-item[role="option"]');
    items.forEach((item, i) => {
      const isFocused = i === appState.searchActiveIdx;
      item.classList.toggle('is-focused', isFocused);
      item.setAttribute('aria-selected', isFocused ? 'true' : 'false');
      if (isFocused) {
        el.locationInput.setAttribute('aria-activedescendant', item.id);
      }
    });
  }

  function selectSearchLocation(loc) {
    if (!loc) return;
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
    if (el.clearSearchBtn) el.clearSearchBtn.classList.add('hidden');
    closeSearchDropdown();
    renderFavoriteChips();
    fetchWeatherData(appState.location);
  }

  async function fetchGeocoding(query) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
      if (!res.ok) return;
      const data = await res.json();
      renderGeocodingResults(data.results || []);
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  }

  function renderGeocodingResults(results) {
    el.searchResults.innerHTML = '';
    appState.searchResultsData = results;
    appState.searchActiveIdx = -1;

    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'search-result-item empty-state';
      empty.textContent = 'No matching cities found';
      el.searchResults.appendChild(empty);
      el.searchResults.classList.remove('hidden');
      el.locationInput.setAttribute('aria-expanded', 'true');
      return;
    }

    results.forEach((loc, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.id = `search-opt-${idx}`;
      item.role = 'option';
      item.className = 'search-result-item';
      item.setAttribute('aria-selected', 'false');
      const stateStr = loc.admin1 ? `, ${loc.admin1}` : '';
      item.innerHTML = `
        <span><strong>${escapeHtml(loc.name)}</strong>${escapeHtml(stateStr)}</span>
        <span class="country">${escapeHtml(loc.country || '')}</span>
      `;
      item.addEventListener('click', () => selectSearchLocation(loc));
      el.searchResults.appendChild(item);
    });

    el.searchResults.classList.remove('hidden');
    el.locationInput.setAttribute('aria-expanded', 'true');
  }

  async function reverseGeocodeCoords(lat, lon) {
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      if (!res.ok) return null;
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision;
      if (!city) return null;
      const country = data.countryName === 'United States of America (the)' ? 'United States' : (data.countryName || '');
      return {
        name: city,
        state: data.principalSubdivision || '',
        country
      };
    } catch (e) {
      return null;
    }
  }

  function getUserGeolocation() {
    if (!navigator.geolocation) {
      showToast('Location services are not supported by this browser.', { type: 'error' });
      return;
    }
    el.cityName.textContent = 'Finding location...';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const resolved = await reverseGeocodeCoords(lat, lon);
        appState.location = {
          name: resolved ? resolved.name : 'Current Location',
          state: resolved ? resolved.state : '',
          country: resolved ? resolved.country : 'GPS',
          lat,
          lon
        };
        saveJSON('pawcast_location', appState.location);
        renderFavoriteChips();
        fetchWeatherData(appState.location);
        showToast(`Location updated to ${appState.location.name}.`, { type: 'success' });
      },
      (err) => {
        showToast(`Could not access GPS location: ${err.message}`, { type: 'error' });
        fetchWeatherData(appState.location);
      },
      { timeout: 10000 }
    );
  }

  function updateUIPreferences() {
    const isImp = appState.units === 'imperial';
    el.unitF.classList.toggle('active', isImp);
    el.unitF.setAttribute('aria-checked', isImp ? 'true' : 'false');
    el.unitC.classList.toggle('active', !isImp);
    el.unitC.setAttribute('aria-checked', !isImp ? 'true' : 'false');

    const activeDog = getActiveDog();
    el.profileBtnLabel.textContent = `Dog: ${activeDog.name} (${appState.dogs.length})`;
  }

  function setUnits(unit) {
    if (appState.units === unit) return;
    appState.units = unit;
    localStorage.setItem('pawcast_units', unit);
    updateUIPreferences();
    if (appState.weather) renderAllWeatherData(appState.weather);
  }

  function renderFavoriteChips() {
    el.favoriteChips.innerHTML = '';
    appState.favorites.forEach((fav, idx) => {
      const isCurrent = fav.name === appState.location.name && Math.abs((fav.lat || 0) - appState.location.lat) < 0.25;
      const group = document.createElement('div');
      group.className = `loc-chip-group ${isCurrent ? 'active' : ''}`;

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'loc-chip-select';
      selectBtn.textContent = fav.name;
      selectBtn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      selectBtn.addEventListener('click', () => {
        playHardwareClick(680);
        appState.location = fav;
        saveJSON('pawcast_location', fav);
        renderFavoriteChips();
        fetchWeatherData(fav);
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${fav.name} from saved cities`);
      removeBtn.title = `Remove ${fav.name}`;
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => {
        playHardwareClick(500);
        removeFavorite(idx);
      });

      group.appendChild(selectBtn);
      group.appendChild(removeBtn);
      el.favoriteChips.appendChild(group);
    });
  }

  function addCurrentLocationToFavorites() {
    const loc = appState.location;
    if (appState.favorites.some(f => f.name === loc.name && Math.abs((f.lat || 0) - loc.lat) < 0.25)) {
      showToast(`${loc.name} is already in Saved Cities.`, { type: 'info' });
      return;
    }
    appState.favorites.push({ ...loc });
    saveJSON('pawcast_favorites', appState.favorites);
    renderFavoriteChips();
    showToast(`Saved ${loc.name} to quick cities.`, { type: 'success' });
  }

  function removeFavorite(idx) {
    const removed = appState.favorites[idx];
    if (!removed) return;
    appState.favorites.splice(idx, 1);
    saveJSON('pawcast_favorites', appState.favorites);
    renderFavoriteChips();

    showToast(`Removed ${removed.name} from Saved Cities.`, {
      type: 'info',
      undoLabel: 'Undo',
      onUndo: () => {
        appState.favorites.splice(Math.min(idx, appState.favorites.length), 0, removed);
        saveJSON('pawcast_favorites', appState.favorites);
        renderFavoriteChips();
      }
    });
  }

  // ==========================================================================
  // WEATHER HELPERS
  // ==========================================================================
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
        return `${h % 12 || 12}:${m < 10 ? '0' : ''}${m}${h < 12 ? 'a' : 'p'}`;
      };
      return `${fmt(sr)} / ${fmt(ss)}`;
    } catch (e) {
      return '6:45a / 6:30p';
    }
  }

  function getLunarPhase(date = new Date()) {
    const lp = 2551443;
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

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
