// Weather / Temperature Widget using Open-Meteo API
document.addEventListener('DOMContentLoaded', () => {
  const cityInput = document.getElementById('weather-city-input');
  const addBtn = document.getElementById('weather-add-btn');
  const weatherIcon = document.getElementById('weather-icon');
  const tempDisplay = document.getElementById('weather-temp');
  const cityDisplay = document.getElementById('weather-city-name');
  const descDisplay = document.getElementById('weather-desc');

  if (!tempDisplay) return;

  let currentCity = 'New York';
  
  chrome.storage.local.get(['weatherCity'], (result) => {
    if (result.weatherCity) currentCity = result.weatherCity;
    fetchWeather(currentCity);
  });

  function updateCity(city) {
    city = city.trim();
    if (!city) return;
    currentCity = city;
    chrome.storage.local.set({ weatherCity: city });
    fetchWeather(currentCity);
  }

  addBtn && addBtn.addEventListener('click', () => {
    updateCity(cityInput.value);
    cityInput.value = '';
  });

  const presetTrigger = document.getElementById('weather-preset-trigger');
  const dropdown = document.getElementById('weather-dropdown');

  const PRESET_CITIES = [
    "London", "New York", "Tokyo", "San Francisco", "Mumbai", "Paris", "Berlin", "Sydney",
    "Dubai", "Singapore", "Moscow", "Hong Kong", "Toronto", "Chicago", "Los Angeles", 
    "Seoul", "Shanghai", "Sao Paulo", "Mexico City", "Cairo", "Lagos", "Istanbul", 
    "Bangkok", "Jakarta", "Delhi", "Beijing", "Madrid", "Rome", "Amsterdam", "Stockholm"
  ];

  if (dropdown) {
    dropdown.innerHTML = PRESET_CITIES.map(city => `<div class="dropdown-item">${city}</div>`).join('');
    
    presetTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        updateCity(item.textContent);
        dropdown.classList.remove('show');
      });
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });
  }

  cityInput && cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

  async function fetchWeather(city) {
    try {
      const cacheKey = `weatherCache_${city.toLowerCase()}`;
      
      // Check cache first
      const cachedData = await new Promise(resolve => {
        chrome.storage.local.get([cacheKey], res => resolve(res[cacheKey]));
      });

      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
        tempDisplay.textContent = cachedData.temp;
        cityDisplay.textContent = cachedData.name;
        weatherIcon.textContent = cachedData.icon;
        descDisplay.textContent = cachedData.desc;
        return; // Return early, use cached data
      }

      tempDisplay.textContent = '...';
      cityDisplay.textContent = city;
      
      // 1. Get coordinates
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      if (!geoRes.ok) throw new Error('Geocoding failed');
      const geoData = await geoRes.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        tempDisplay.textContent = '--°';
        descDisplay.textContent = 'City not found';
        return;
      }
      
      const { latitude, longitude, name } = geoData.results[0];
      cityDisplay.textContent = name; // update with formatted name

      // 2. Get weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
      if (!weatherRes.ok) throw new Error('Weather failed');
      const weatherData = await weatherRes.json();
      
      const temp = Math.round(weatherData.current.temperature_2m);
      const code = weatherData.current.weather_code;
      
      const tempString = `${temp}°C`;
      tempDisplay.textContent = tempString;
      
      // Map WMO weather codes to emojis and descriptions
      const weatherInfo = getWeatherInfo(code);
      weatherIcon.textContent = weatherInfo.icon;
      descDisplay.textContent = weatherInfo.desc;

      // Save to cache
      chrome.storage.local.set({
        [cacheKey]: {
          timestamp: Date.now(),
          temp: tempString,
          name: name,
          icon: weatherInfo.icon,
          desc: weatherInfo.desc
        }
      });
      
    } catch (err) {
      tempDisplay.textContent = '--°';
      descDisplay.textContent = 'Error loading';
    }
  }

  function getWeatherInfo(code) {
    // WMO Weather interpretation codes
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
