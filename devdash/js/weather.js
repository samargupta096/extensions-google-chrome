// Weather / Temperature Widget using Open-Meteo API
document.addEventListener('DOMContentLoaded', () => {
  const locateBtn = document.getElementById('weather-locate-btn');
  const weatherIcon = document.getElementById('weather-icon');
  const tempDisplay = document.getElementById('weather-temp');
  const cityDisplay = document.getElementById('weather-city-name');
  const descDisplay = document.getElementById('weather-desc');
  const hourlyContainer = document.getElementById('weather-hourly');

  if (!tempDisplay) return;

  // Initial load
  chrome.storage.local.get(['weatherCoords'], (result) => {
    if (result.weatherCoords) {
      fetchWeatherByCoords(result.weatherCoords.lat, result.weatherCoords.lon, result.weatherCoords.name);
    } else {
      // Auto-locate on first load if no saved coordinates
      autoLocate();
    }
  });

  function autoLocate() {
    if (navigator.geolocation) {
      if (locateBtn) locateBtn.textContent = '⌛';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          fetchWeatherByCoords(lat, lon, 'Current Location');
          if (locateBtn) locateBtn.textContent = '📍';
        },
        (err) => {
          console.error('Geolocation error:', err);
          if (locateBtn) {
            locateBtn.textContent = '❌';
            setTimeout(() => locateBtn.textContent = '📍', 2000);
          }
          // Fallback to a default if user denies geolocation and nothing is stored
          fetchWeatherByCoords(40.71, -74.01, 'New York');
        }
      );
    }
  }

  locateBtn && locateBtn.addEventListener('click', autoLocate);

  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

  async function fetchWeatherByCoords(lat, lon, label) {
    try {
      const cacheKey = `weatherCache_coords_${lat.toFixed(2)}_${lon.toFixed(2)}`;
      
      const cachedData = await new Promise(resolve => {
        chrome.storage.local.get([cacheKey], res => resolve(res[cacheKey]));
      });

      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
        renderWeather(cachedData);
        return;
      }

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&forecast_days=1`);
      if (!weatherRes.ok) throw new Error('Weather failed');
      const weatherData = await weatherRes.json();
      
      const current = weatherData.current;
      const hourly = weatherData.hourly;
      
      const weatherInfo = getWeatherInfo(current.weather_code);
      
      let locationName = label;
      if (label === 'Current Location') {
        try {
          const revGeoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
          if (revGeoRes.ok) {
            const revGeoData = await revGeoRes.json();
            locationName = revGeoData.city || revGeoData.locality || revGeoData.principalSubdivision || 'My Location';
          }
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        }
      }

      const dataToCache = {
        timestamp: Date.now(),
        temp: Math.round(current.temperature_2m),
        name: locationName,
        icon: weatherInfo.icon,
        desc: weatherInfo.desc,
        hourly: hourly.time.map((t, i) => ({
          time: new Date(t).getHours(),
          temp: Math.round(hourly.temperature_2m[i]),
          icon: getWeatherInfo(hourly.weather_code[i]).icon
        })).filter((_, i) => i % 3 === 0) // Every 3 hours
      };

      chrome.storage.local.set({ 
        [cacheKey]: dataToCache,
        weatherCoords: { lat, lon, name: dataToCache.name }
      });
      
      renderWeather(dataToCache);
      
    } catch (err) {
      console.error(err);
      tempDisplay.textContent = '--°';
      descDisplay.textContent = 'Error';
    }
  }

  function renderWeather(data) {
    tempDisplay.textContent = `${data.temp}°C`;
    cityDisplay.textContent = data.name;
    weatherIcon.textContent = data.icon;
    descDisplay.textContent = data.desc;
    
    if (hourlyContainer && data.hourly) {
      hourlyContainer.innerHTML = data.hourly.map(h => `
        <div class="hourly-item">
          <span class="hourly-time">${h.time}:00</span>
          <span class="hourly-icon">${h.icon}</span>
          <span class="hourly-temp">${h.temp}°</span>
        </div>
      `).join('');
    }
  }

  function getWeatherInfo(code) {
    if (code === 0) return { icon: '☀️', desc: 'Clear sky' };
    if (code === 1 || code === 2 || code === 3) return { icon: '⛅', desc: 'Partly cloudy' };
    if (code === 45 || code === 48) return { icon: '🌫️', desc: 'Fog' };
    if (code >= 51 && code <= 55) return { icon: '🌧️', desc: 'Drizzle' };
    if (code >= 61 && code <= 65) return { icon: '🌧️', desc: 'Rain' };
    if (code >= 71 && code <= 77) return { icon: '❄️', desc: 'Snow' };
    if (code >= 80 && code <= 82) return { icon: '🌦️', desc: 'Rain showers' };
    if (code >= 85 && code <= 86) return { icon: '🌨️', desc: 'Snow showers' };
    if (code >= 95 && code <= 99) return { icon: '⛈️', desc: 'Thunderstorm' };
    return { icon: '☁️', desc: 'Unknown' };
  }
});
