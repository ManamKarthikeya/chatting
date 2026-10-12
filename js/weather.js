/**
 * iWeather Weather Dashboard Engine
 * Fetches real weather data via Open-Meteo API (free, open, no API key needed),
 * with realistic dynamic mock fallbacks so the camouflage never fails.
 */

class WeatherDashboard {
  constructor() {
    this.currentCity = 'Bangalore';
    this.currentLat = 12.9716;
    this.currentLon = 77.5946;

    this.cityDisplay = document.getElementById('weather-city-display');
    this.tempValue = document.getElementById('weather-temp-value');
    this.condDisplay = document.getElementById('weather-condition-display');
    this.tempHigh = document.getElementById('weather-temp-high');
    this.tempLow = document.getElementById('weather-temp-low');
    this.hourlyList = document.getElementById('hourly-forecast-list');
    this.dailyList = document.getElementById('daily-forecast-list');

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadWeatherForCity(this.currentCity, this.currentLat, this.currentLon);
  }

  bindEvents() {
    // Discreet Lock button on weather nav
    const lockBtn = document.getElementById('btn-weather-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        if (window.App) window.App.openPattern();
      });
    }

    // Secret triple tap on iWeather brand logo
    const brandBtn = document.getElementById('weather-brand-logo-btn');
    let tapCount = 0;
    let tapTimer = null;
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        tapCount++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 800);
        if (tapCount >= 3) {
          tapCount = 0;
          if (window.App) window.App.openPattern();
        }
      });
    }

    // Search modal open / close
    const searchBtn = document.getElementById('btn-weather-search');
    const searchModal = document.getElementById('weather-search-modal');
    const closeSearchBtn = document.getElementById('btn-close-search');
    const searchInput = document.getElementById('city-search-input');

    if (searchBtn && searchModal) {
      searchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        if (searchInput) searchInput.focus();
      });
    }

    if (closeSearchBtn && searchModal) {
      closeSearchBtn.addEventListener('click', () => {
        searchModal.classList.remove('active');
      });
    }

    // Quick select cities in modal
    const searchItems = document.querySelectorAll('.search-result-item');
    searchItems.forEach((item) => {
      item.addEventListener('click', () => {
        const city = item.getAttribute('data-city');
        const coords = this.getCoordsForCity(city);
        this.loadWeatherForCity(city, coords.lat, coords.lon);
        if (searchModal) searchModal.classList.remove('active');
      });
    });

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          const query = searchInput.value.trim();
          this.searchGeocodingCity(query);
          if (searchModal) searchModal.classList.remove('active');
        }
      });
    }
  }

  getCoordsForCity(city) {
    const map = {
      'Bangalore': { lat: 12.9716, lon: 77.5946 },
      'Mumbai': { lat: 19.0760, lon: 72.8777 },
      'Hyderabad': { lat: 17.3850, lon: 78.4867 },
      'London': { lat: 51.5074, lon: -0.1278 },
      'New York': { lat: 40.7128, lon: -74.0060 }
    };
    return map[city] || { lat: 12.9716, lon: 77.5946 };
  }

  async searchGeocodingCity(query) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const loc = data.results[0];
        this.loadWeatherForCity(loc.name, loc.latitude, loc.longitude);
      } else {
        this.loadWeatherForCity(query, 12.97, 77.59);
      }
    } catch (e) {
      this.loadWeatherForCity(query, 12.97, 77.59);
    }
  }

  async loadWeatherForCity(cityName, lat, lon) {
    this.currentCity = cityName;
    if (this.cityDisplay) this.cityDisplay.textContent = cityName;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      this.renderApiWeather(data);
    } catch (err) {
      // Fallback to high-fidelity realistic simulated weather
      this.renderSimulatedWeather(cityName);
    }
  }

  renderApiWeather(data) {
    const current = data.current || {};
    const temp = Math.round(current.temperature_2m || 27);
    const code = current.weather_code || 1;
    const cond = this.getWeatherDesc(code);

    if (this.tempValue) this.tempValue.textContent = temp;
    if (this.condDisplay) this.condDisplay.textContent = cond;

    const daily = data.daily || {};
    const high = Math.round(daily.temperature_2m_max ? daily.temperature_2m_max[0] : temp + 4);
    const low = Math.round(daily.temperature_2m_min ? daily.temperature_2m_min[0] : temp - 5);

    if (this.tempHigh) this.tempHigh.innerHTML = `${high}&deg;`;
    if (this.tempLow) this.tempLow.innerHTML = `${low}&deg;`;

    // Metrics
    const humEl = document.getElementById('metric-humidity');
    if (humEl && current.relative_humidity_2m) humEl.textContent = `${current.relative_humidity_2m}%`;

    const windEl = document.getElementById('metric-wind');
    if (windEl && current.wind_speed_10m) windEl.innerHTML = `${Math.round(current.wind_speed_10m)} <span style="font-size:16px;">km/h</span>`;

    const uvEl = document.getElementById('metric-uv');
    if (uvEl && daily.uv_index_max) uvEl.textContent = Math.round(daily.uv_index_max[0] || 4);

    // Hourly
    this.renderHourly(data.hourly);
    // Daily
    this.renderDaily(data.daily);
  }

  renderHourly(hourly) {
    if (!this.hourlyList || !hourly) return;
    this.hourlyList.innerHTML = '';

    const currentHour = new Date().getHours();
    const temps = hourly.temperature_2m || [];
    const codes = hourly.weather_code || [];

    for (let i = 0; i < 24; i += 2) {
      const hourIndex = (currentHour + i) % 24;
      const displayTime = i === 0 ? 'Now' : `${(currentHour + i) % 12 || 12} ${(currentHour + i) % 24 >= 12 ? 'PM' : 'AM'}`;
      const temp = Math.round(temps[hourIndex] || 26);
      const icon = this.getWeatherIcon(codes[hourIndex] || 1);

      const slot = document.createElement('div');
      slot.className = 'hourly-slot';
      slot.innerHTML = `
        <span class="hourly-time">${displayTime}</span>
        <div class="hourly-icon">${icon}</div>
        <span class="hourly-temp">${temp}&deg;</span>
      `;
      this.hourlyList.appendChild(slot);
    }
  }

  renderDaily(daily) {
    if (!this.dailyList || !daily) return;
    this.dailyList.innerHTML = '';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIndex = new Date().getDay();
    const maxTemps = daily.temperature_2m_max || [];
    const minTemps = daily.temperature_2m_min || [];
    const codes = daily.weather_code || [];

    for (let i = 0; i < 7; i++) {
      const dayName = i === 0 ? 'Today' : days[(todayIndex + i) % 7];
      const max = Math.round(maxTemps[i] || 30 - i % 3);
      const min = Math.round(minTemps[i] || 20 - i % 2);
      const icon = this.getWeatherIcon(codes[i] || 1);

      const row = document.createElement('div');
      row.className = 'daily-row';
      row.innerHTML = `
        <span class="daily-day">${dayName}</span>
        <div class="daily-icon">${icon}</div>
        <div class="daily-bar-wrap">
          <span class="temp-min">${min}&deg;</span>
          <div class="temp-bar">
            <div class="temp-bar-fill" style="left: ${((min - 15) / 25) * 100}%; width: 45%;"></div>
          </div>
          <span class="temp-max">${max}&deg;</span>
        </div>
      `;
      this.dailyList.appendChild(row);
    }
  }

  renderSimulatedWeather(city) {
    const temp = 27;
    if (this.tempValue) this.tempValue.textContent = temp;
    if (this.condDisplay) this.condDisplay.textContent = 'Partly Cloudy';
    if (this.tempHigh) this.tempHigh.innerHTML = '31&deg;';
    if (this.tempLow) this.tempLow.innerHTML = '21&deg;';

    // Mock hourly
    if (this.hourlyList) {
      this.hourlyList.innerHTML = '';
      const currentHour = new Date().getHours();
      for (let i = 0; i < 14; i += 2) {
        const time = i === 0 ? 'Now' : `${(currentHour + i) % 12 || 12} ${(currentHour + i) % 24 >= 12 ? 'PM' : 'AM'}`;
        const slot = document.createElement('div');
        slot.className = 'hourly-slot';
        slot.innerHTML = `
          <span class="hourly-time">${time}</span>
          <div class="hourly-icon">${this.getWeatherIcon(1)}</div>
          <span class="hourly-temp">${27 - Math.floor(i / 3)}&deg;</span>
        `;
        this.hourlyList.appendChild(slot);
      }
    }

    // Mock daily
    if (this.dailyList) {
      this.dailyList.innerHTML = '';
      const days = ['Today', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.forEach((day, idx) => {
        const row = document.createElement('div');
        row.className = 'daily-row';
        row.innerHTML = `
          <span class="daily-day">${day}</span>
          <div class="daily-icon">${this.getWeatherIcon(idx % 2)}</div>
          <div class="daily-bar-wrap">
            <span class="temp-min">${21 + (idx % 2)}&deg;</span>
            <div class="temp-bar">
              <div class="temp-bar-fill" style="left: 20%; width: 50%;"></div>
            </div>
            <span class="temp-max">${30 + (idx % 3)}&deg;</span>
          </div>
        `;
        this.dailyList.appendChild(row);
      });
    }
  }

  getWeatherDesc(code) {
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Misty / Foggy';
    if (code <= 67) return 'Light Rain';
    if (code <= 82) return 'Rain Showers';
    return 'Thunderstorm';
  }

  getWeatherIcon(code) {
    if (code === 0) {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>`;
    }
    if (code <= 3) {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`;
    }
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path><line x1="8" y1="19" x2="6" y2="22"></line><line x1="12" y1="19" x2="10" y2="22"></line><line x1="16" y1="19" x2="14" y2="22"></line></svg>`;
  }
}

window.WeatherDashboard = WeatherDashboard;
