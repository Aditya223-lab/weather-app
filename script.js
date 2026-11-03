/* ==========================================================================
   Weather — a vanilla JavaScript weather app on the Open-Meteo API
   --------------------------------------------------------------------------
   Two endpoints, no API key:
     1. geocoding-api.open-meteo.com  → city name to coordinates
     2. api.open-meteo.com/v1/forecast → current, hourly and daily data
   Data is fetched once in metric and converted client-side, so flipping
   between °C and °F never triggers a network request.
   ========================================================================== */

(function () {
  "use strict";

  /* ───────────── Config ───────────── */

  const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  const RECENTS_KEY = "weather.recents";
  const UNIT_KEY = "weather.unit";
  const THEME_KEY = "weather.theme";
  const LAST_KEY = "weather.last";

  const MAX_RECENTS = 5;

  const QUICK_CITIES = [
    { name: "Kathmandu", country: "Nepal", latitude: 27.7172, longitude: 85.324, country_code: "NP" },
    { name: "London", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276, country_code: "GB" },
    { name: "Tokyo", country: "Japan", latitude: 35.6895, longitude: 139.6917, country_code: "JP" },
    { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.006, country_code: "US" },
  ];

  /* ───────────── Weather code table ───────────── */

  const WX = {
    0: { label: "Clear sky", icon: "clear", sky: "clear" },
    1: { label: "Mainly clear", icon: "mostly-clear", sky: "clear" },
    2: { label: "Partly cloudy", icon: "partly-cloudy", sky: "cloud" },
    3: { label: "Overcast", icon: "cloudy", sky: "cloud" },
    45: { label: "Fog", icon: "fog", sky: "cloud" },
    48: { label: "Freezing fog", icon: "fog", sky: "cloud" },
    51: { label: "Light drizzle", icon: "drizzle", sky: "rain" },
    53: { label: "Drizzle", icon: "drizzle", sky: "rain" },
    55: { label: "Heavy drizzle", icon: "drizzle", sky: "rain" },
    56: { label: "Freezing drizzle", icon: "sleet", sky: "rain" },
    57: { label: "Freezing drizzle", icon: "sleet", sky: "rain" },
    61: { label: "Light rain", icon: "rain", sky: "rain" },
    63: { label: "Rain", icon: "rain", sky: "rain" },
    65: { label: "Heavy rain", icon: "rain", sky: "rain" },
    66: { label: "Freezing rain", icon: "sleet", sky: "rain" },
    67: { label: "Freezing rain", icon: "sleet", sky: "rain" },
    71: { label: "Light snow", icon: "snow", sky: "snow" },
    73: { label: "Snow", icon: "snow", sky: "snow" },
    75: { label: "Heavy snow", icon: "snow", sky: "snow" },
    77: { label: "Snow grains", icon: "snow", sky: "snow" },
    80: { label: "Light showers", icon: "showers", sky: "rain" },
    81: { label: "Showers", icon: "showers", sky: "rain" },
    82: { label: "Violent showers", icon: "showers", sky: "rain" },
    85: { label: "Snow showers", icon: "snow", sky: "snow" },
    86: { label: "Heavy snow showers", icon: "snow", sky: "snow" },
    95: { label: "Thunderstorm", icon: "storm", sky: "storm" },
    96: { label: "Thunderstorm, hail", icon: "storm", sky: "storm" },
    99: { label: "Thunderstorm, heavy hail", icon: "storm", sky: "storm" },
  };

  const describe = (code) => WX[code] || { label: "Unknown", icon: "cloudy", sky: "cloud" };

  /* ───────────── Icons (static SVG markup) ───────────── */

  const SUN = '<circle class="wx-sun" cx="32" cy="32" r="11" fill="url(#sunG)"/><g class="wx-sun" stroke="url(#sunG)" stroke-width="3.4" stroke-linecap="round"><path d="M32 11v-6M32 59v-6M11 32H5M59 32h-6M17.2 17.2l-4.3-4.3M51.1 51.1l-4.3-4.3M46.8 17.2l4.3-4.3M12.9 51.1l4.3-4.3"/></g>';
  const MOON = '<path class="wx-sun" d="M43 38a16 16 0 0 1-19-19 17 17 0 1 0 19 19z" fill="url(#moonG)"/>';
  const CLOUD = '<path class="wx-cloud" d="M47 48H21a10.5 10.5 0 0 1-1.4-20.9 15.5 15.5 0 0 1 29.6-1.6A11.2 11.2 0 0 1 47 48z" fill="url(#cloudG)"/>';
  const SMALL_CLOUD = '<path class="wx-cloud" d="M50 50H27a9 9 0 0 1-1.2-17.9 13.3 13.3 0 0 1 25.4-1.4A9.6 9.6 0 0 1 50 50z" fill="url(#cloudG)"/>';

  const ICONS = {
    clear: SUN,
    "clear-night": MOON,
    "mostly-clear":
      '<g transform="translate(-6,-6) scale(0.82)"><circle class="wx-sun" cx="32" cy="32" r="10" fill="url(#sunG)"/><g class="wx-sun" stroke="url(#sunG)" stroke-width="3.2" stroke-linecap="round"><path d="M32 13v-5M13 32H8M18 18l-3.6-3.6M46 18l3.6-3.6"/></g></g>' +
      SMALL_CLOUD,
    "mostly-clear-night":
      '<g transform="translate(-7,-7) scale(0.74)">' + MOON + "</g>" + SMALL_CLOUD,
    "partly-cloudy":
      '<g transform="translate(-4,-7) scale(0.7)"><circle class="wx-sun" cx="32" cy="32" r="11" fill="url(#sunG)"/><g class="wx-sun" stroke="url(#sunG)" stroke-width="3.6" stroke-linecap="round"><path d="M32 12V6M12 32H6M18 18l-4-4M46 18l4-4"/></g></g>' +
      CLOUD,
    "partly-cloudy-night": '<g transform="translate(-5,-8) scale(0.66)">' + MOON + "</g>" + CLOUD,
    cloudy:
      '<path class="wx-cloud" d="M40 22a13 13 0 0 1 12.4 9.2A9 9 0 0 1 51 49H25a11 11 0 0 1-1.4-21.9A13 13 0 0 1 40 22z" fill="url(#cloudG2)" opacity=".75"/>' +
      CLOUD,
    fog:
      CLOUD +
      '<g stroke="url(#cloudG2)" stroke-width="3.4" stroke-linecap="round" class="wx-cloud"><path d="M16 54h32M22 60h22"/></g>',
    drizzle:
      CLOUD +
      '<g stroke="url(#rainG)" stroke-width="3.2" stroke-linecap="round"><path class="wx-drop" d="M25 54v3"/><path class="wx-drop" d="M34 54v4"/><path class="wx-drop" d="M43 54v3"/></g>',
    rain:
      CLOUD +
      '<g stroke="url(#rainG)" stroke-width="3.6" stroke-linecap="round"><path class="wx-drop" d="M24 53v6"/><path class="wx-drop" d="M34 53v8"/><path class="wx-drop" d="M44 53v6"/></g>',
    showers:
      CLOUD +
      '<g stroke="url(#rainG)" stroke-width="3.6" stroke-linecap="round"><path class="wx-drop" d="M23 53l-2 7"/><path class="wx-drop" d="M33 53l-2 9"/><path class="wx-drop" d="M43 53l-2 7"/></g>',
    sleet:
      CLOUD +
      '<g stroke="url(#rainG)" stroke-width="3.4" stroke-linecap="round"><path class="wx-drop" d="M24 53v6"/><path class="wx-drop" d="M43 53v6"/></g>' +
      '<g stroke="url(#snowG)" stroke-width="2.8" stroke-linecap="round"><g class="wx-flake" transform="translate(34,57)"><path d="M0-4.5V4.5M-4-2.2 4 2.2M-4 2.2 4-2.2"/></g></g>',
    snow:
      CLOUD +
      '<g stroke="url(#snowG)" stroke-width="2.8" stroke-linecap="round"><g class="wx-flake" transform="translate(24,57)"><path d="M0-5V5M-4.3-2.5 4.3 2.5M-4.3 2.5 4.3-2.5"/></g><g class="wx-flake" transform="translate(42,57)"><path d="M0-5V5M-4.3-2.5 4.3 2.5M-4.3 2.5 4.3-2.5"/></g></g>',
    storm:
      CLOUD +
      '<path class="wx-bolt" d="M34 50h7l-5 8h6l-11 13 3-11h-5z" fill="url(#boltG)"/>' +
      '<g stroke="url(#rainG)" stroke-width="3" stroke-linecap="round"><path class="wx-drop" d="M23 53v6"/><path class="wx-drop" d="M47 53v6"/></g>',
  };

  const GRADIENTS =
    "<defs>" +
    '<linearGradient id="sunG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>' +
    '<linearGradient id="moonG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>' +
    '<linearGradient id="cloudG" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#b5c2d3"/></linearGradient>' +
    '<linearGradient id="cloudG2" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="1" stop-color="#8d9cb0"/></linearGradient>' +
    '<linearGradient id="rainG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#2563eb"/></linearGradient>' +
    '<linearGradient id="snowG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a5d8f3"/></linearGradient>' +
    '<linearGradient id="boltG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>' +
    "</defs>";

  /**
   * Build a weather icon. The markup is entirely from the constants above —
   * no user or API string is ever interpolated into it.
   */
  function iconSvg(code, isDay) {
    const base = describe(code).icon;
    const key = !isDay && ICONS[base + "-night"] ? base + "-night" : base;
    const body = ICONS[key] || ICONS.cloudy;
    return (
      '<svg viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      GRADIENTS +
      body +
      "</svg>"
    );
  }

  /* ───────────── Elements ───────────── */

  const $ = (s) => document.querySelector(s);

  const el = {
    html: document.documentElement,
    body: document.body,
    themeToggle: $("#themeToggle"),
    themeMeta: $('meta[name="theme-color"]'),
    unitC: $("#unitC"),
    unitF: $("#unitF"),

    form: $("#searchForm"),
    input: $("#cityInput"),
    clearInput: $("#clearInput"),
    suggestions: $("#suggestions"),
    geoBtn: $("#geoBtn"),
    recents: $("#recents"),
    recentsList: $("#recentsList"),
    quickCities: $("#quickCities"),

    loading: $("#loading"),
    error: $("#error"),
    errorTitle: $("#errorTitle"),
    errorBody: $("#errorBody"),
    retryBtn: $("#retryBtn"),
    welcome: $("#welcome"),
    result: $("#result"),

    placeName: $("#placeName"),
    placeMeta: $("#placeMeta"),
    tempNow: $("#tempNow"),
    tempUnit: $("#tempUnit"),
    condition: $("#condition"),
    feelsLike: $("#feelsLike"),
    heroIcon: $("#heroIcon"),
    todayHigh: $("#todayHigh"),
    todayLow: $("#todayLow"),
    detailGrid: $("#detailGrid"),

    hourlyChart: $("#hourlyChart"),
    hourlyStrip: $("#hourlyStrip"),
    hourlyNote: $("#hourlyNote"),
    dailyList: $("#dailyList"),
    dailyNote: $("#dailyNote"),

    updatedAt: $("#updatedAt"),
    toast: $("#toast"),
    toastMsg: $("#toastMsg"),
    srStatus: $("#srStatus"),
  };

  /* ───────────── State ───────────── */

  const state = {
    unit: "c", // c | f
    place: null, // { name, country, admin1, latitude, longitude, country_code }
    data: null, // raw forecast payload (always metric)
    recents: [],
    suggestions: [],
    activeSuggestion: -1,
  };

  let geoAbort = null;
  let forecastAbort = null;
  let toastTimer = null;
  let suggestTimer = null;

  /* ───────────── Storage ───────────── */

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — not fatal */
    }
  }

  /* ───────────── Units & formatting ───────────── */

  const toF = (c) => (c * 9) / 5 + 32;

  function temp(celsius, withUnit) {
    if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return "—";
    const v = state.unit === "f" ? toF(celsius) : celsius;
    return Math.round(v) + (withUnit ? (state.unit === "f" ? "°F" : "°C") : "°");
  }

  function speed(kmh) {
    if (kmh === null || kmh === undefined) return { value: "—", unit: "" };
    return state.unit === "f"
      ? { value: Math.round(kmh * 0.621371), unit: "mph" }
      : { value: Math.round(kmh), unit: "km/h" };
  }

  function distance(km) {
    return state.unit === "f"
      ? { value: (km * 0.621371).toFixed(1), unit: "mi" }
      : { value: km.toFixed(1), unit: "km" };
  }

  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const bearing = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

  /** Format an ISO local timestamp from the API in the location's own time. */
  function hourLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric" }).replace(/\s/g, "");
  }

  function clockLabel(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function dayLabels(iso, index) {
    const d = new Date(iso + "T00:00:00");
    return {
      primary: index === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      secondary: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  }

  function flagOf(code) {
    if (typeof code !== "string" || code.length !== 2) return "📍";
    const base = 0x1f1e6;
    return String.fromCodePoint(
      base + code.toUpperCase().charCodeAt(0) - 65,
      base + code.toUpperCase().charCodeAt(1) - 65
    );
  }

  function placeLabel(p) {
    return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
  }

  /* ───────────── View switching ───────────── */

  function showView(name) {
    el.welcome.hidden = name !== "welcome";
    el.loading.hidden = name !== "loading";
    el.error.hidden = name !== "error";
    el.result.hidden = name !== "result";
    el.loading.setAttribute("aria-hidden", String(name !== "loading"));
  }

  function showError(title, body) {
    el.errorTitle.textContent = title;
    el.errorBody.textContent = body;
    showView("error");
    announce(title + ". " + body);
  }

  function toast(message) {
    clearTimeout(toastTimer);
    el.toastMsg.textContent = message;
    el.toast.hidden = false;
    announce(message);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, 3200);
  }

  function announce(message) {
    el.srStatus.textContent = "";
    setTimeout(() => {
      el.srStatus.textContent = message;
    }, 60);
  }

  /* ───────────── Networking ───────────── */

  async function fetchJson(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function geocode(query, signal) {
    const url =
      GEO_URL +
      "?name=" +
      encodeURIComponent(query) +
      "&count=6&language=en&format=json";
    const data = await fetchJson(url, signal);
    return Array.isArray(data.results) ? data.results : [];
  }

  async function fetchForecast(lat, lon, signal) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      hourly: "temperature_2m,weather_code,precipitation_probability,is_day,visibility",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max",
      timezone: "auto",
      forecast_days: "7",
    });
    return fetchJson(FORECAST_URL + "?" + params.toString(), signal);
  }

  /* ───────────── Load a place ───────────── */

  async function loadPlace(place) {
    hideSuggestions();

    if (forecastAbort) forecastAbort.abort();
    forecastAbort = new AbortController();

    state.place = place;
    showView("loading");
    announce("Loading weather for " + place.name);

    try {
      const data = await fetchForecast(place.latitude, place.longitude, forecastAbort.signal);
      state.data = data;
      renderAll();
      showView("result");
      rememberPlace(place);
      writeStore(LAST_KEY, place);
    } catch (err) {
      if (err.name === "AbortError") return;

      if (!navigator.onLine) {
        showError("You are offline", "Reconnect to the internet and try again.");
      } else if (err.status) {
        showError(
          "The weather service had a problem",
          "Open-Meteo returned an error (" + err.status + "). Please try again shortly."
        );
      } else {
        showError("Could not load the forecast", "Check your connection and try again.");
      }
    }
  }

  /* ───────────── Rendering ───────────── */

  function renderAll() {
    if (!state.data || !state.place) return;
    renderCurrent();
    renderHourly();
    renderDaily();

    el.updatedAt.textContent = "Updated " + clockLabel(new Date().toISOString());
    document.title = temp(state.data.current.temperature_2m, true) + " · " + state.place.name;
  }

  function renderCurrent() {
    const p = state.place;
    const c = state.data.current;
    const d = state.data.daily;
    const wx = describe(c.weather_code);
    const isDay = c.is_day === 1;

    el.placeName.textContent = p.name;
    el.placeMeta.textContent =
      [p.admin1, p.country].filter(Boolean).join(", ") +
      (state.data.timezone ? " · " + state.data.timezone.replace(/_/g, " ") : "");

    el.tempNow.textContent = Math.round(
      state.unit === "f" ? toF(c.temperature_2m) : c.temperature_2m
    );
    el.tempUnit.textContent = state.unit === "f" ? "°F" : "°C";
    el.condition.textContent = wx.label;
    el.feelsLike.textContent = "Feels like " + temp(c.apparent_temperature);

    el.heroIcon.innerHTML = iconSvg(c.weather_code, isDay);

    el.todayHigh.textContent = temp(d.temperature_2m_max[0]);
    el.todayLow.textContent = temp(d.temperature_2m_min[0]);

    // Condition-driven backdrop
    el.body.dataset.sky = isDay ? wx.sky : wx.sky === "clear" ? "night" : wx.sky;
    if (el.themeMeta) {
      el.themeMeta.setAttribute(
        "content",
        el.html.dataset.theme === "dark" ? "#080c16" : "#0ea5e9"
      );
    }

    renderDetails(c, d);
  }

  function renderDetails(c, d) {
    const wind = speed(c.wind_speed_10m);
    const gust = speed(c.wind_gusts_10m);
    const vis = currentVisibility();

    const items = [
      {
        label: "Wind",
        icon: '<path d="M4 10h11a3.5 3.5 0 1 0-3.5-3.5"/><path d="M4 15h8a3 3 0 1 1-3 3"/>',
        value: wind.value,
        sub: wind.unit + " " + bearing(c.wind_direction_10m),
      },
      {
        label: "Humidity",
        icon: '<path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3z"/>',
        value: Math.round(c.relative_humidity_2m),
        sub: "%",
      },
      {
        label: "Gusts",
        icon: '<path d="M3 8h9a3 3 0 1 0-3-3"/><path d="M3 13h13"/><path d="M3 18h7a2.5 2.5 0 1 1-2.5 2.5"/>',
        value: gust.value,
        sub: gust.unit,
      },
      {
        label: "UV index",
        icon: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4"/>',
        value: d.uv_index_max[0] === null ? "—" : Math.round(d.uv_index_max[0]),
        sub: uvWord(d.uv_index_max[0]),
      },
      {
        label: "Pressure",
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-3"/>',
        value: Math.round(c.pressure_msl),
        sub: "hPa",
      },
      {
        label: "Cloud cover",
        icon: '<path d="M17.5 19H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4-.7A4.3 4.3 0 0 1 17.5 19z"/>',
        value: Math.round(c.cloud_cover),
        sub: "%",
      },
      {
        label: "Visibility",
        icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
        value: vis ? vis.value : "—",
        sub: vis ? vis.unit : "",
      },
      {
        label: "Sunrise",
        icon: '<path d="M12 4v4M5 12H2m20 0h-3M6.3 6.3 4.2 4.2m15.6 2.1 2.1-2.1"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M2 21h20"/>',
        value: clockLabel(d.sunrise[0]),
        sub: "",
      },
      {
        label: "Sunset",
        icon: '<path d="M12 10V6M5 16H2m20 0h-3M6.3 10.3 4.2 8.2m15.6 2.1 2.1-2.1"/><path d="M7 20a5 5 0 0 1 10 0"/><path d="M2 21h20"/>',
        value: clockLabel(d.sunset[0]),
        sub: "",
      },
      {
        label: "Rain chance",
        icon: '<path d="M17.5 15H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4-.7A4.3 4.3 0 0 1 17.5 15z"/><path d="M9 19v2m3-3v3m3-4v2"/>',
        value: d.precipitation_probability_max[0] ?? 0,
        sub: "%",
      },
    ];

    const frag = document.createDocumentFragment();

    for (const item of items) {
      const wrap = document.createElement("div");
      wrap.className = "detail";

      const dt = document.createElement("dt");
      // Static icon markup, then the label as a text node.
      dt.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        item.icon +
        "</svg>";
      dt.appendChild(document.createTextNode(item.label));

      const dd = document.createElement("dd");
      dd.appendChild(document.createTextNode(String(item.value)));
      if (item.sub) {
        const small = document.createElement("small");
        small.textContent = item.sub;
        dd.appendChild(small);
      }

      wrap.append(dt, dd);
      frag.appendChild(wrap);
    }

    el.detailGrid.replaceChildren(frag);
  }

  function uvWord(uv) {
    if (uv === null || uv === undefined) return "";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
  }

  /** Visibility is hourly-only, so read the slot closest to now. */
  function currentVisibility() {
    const h = state.data.hourly;
    if (!h || !h.visibility) return null;
    const i = nowHourIndex();
    const metres = h.visibility[i];
    if (metres === null || metres === undefined) return null;
    return distance(metres / 1000);
  }

  /** Index of the hourly slot matching the current time at the location. */
  function nowHourIndex() {
    const times = state.data.hourly.time;
    const nowMs = Date.now() + (state.data.utc_offset_seconds || 0) * 1000;
    // API times are local-to-location; compare against a shifted "now".
    const nowLocal = new Date(nowMs).toISOString().slice(0, 13);
    const found = times.findIndex((t) => t.slice(0, 13) === nowLocal);
    return found === -1 ? 0 : found;
  }

  function renderHourly() {
    const h = state.data.hourly;
    const start = nowHourIndex();
    const slice = [];

    for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
      slice.push({
        time: h.time[i],
        temp: h.temperature_2m[i],
        code: h.weather_code[i],
        isDay: h.is_day ? h.is_day[i] === 1 : true,
        pop: h.precipitation_probability ? h.precipitation_probability[i] : null,
        isNow: i === start,
      });
    }

    // Strip
    const frag = document.createDocumentFragment();

    for (const hr of slice) {
      const cell = document.createElement("div");
      cell.className = "hour" + (hr.isNow ? " is-now" : "");

      const time = document.createElement("span");
      time.className = "hour-time";
      time.textContent = hr.isNow ? "Now" : hourLabel(hr.time);

      const icon = document.createElement("span");
      icon.className = "hour-icon";
      icon.innerHTML = iconSvg(hr.code, hr.isDay);

      const t = document.createElement("span");
      t.className = "hour-temp";
      t.textContent = temp(hr.temp);

      const pop = document.createElement("span");
      pop.className = "hour-pop";
      if (hr.pop !== null && hr.pop >= 20) {
        pop.innerHTML =
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3z"/></svg>';
        pop.appendChild(document.createTextNode(hr.pop + "%"));
      }

      cell.append(time, icon, t, pop);
      cell.setAttribute(
        "aria-label",
        (hr.isNow ? "Now" : hourLabel(hr.time)) +
          ": " +
          temp(hr.temp, true) +
          ", " +
          describe(hr.code).label
      );
      frag.appendChild(cell);
    }

    el.hourlyStrip.replaceChildren(frag);
    el.hourlyStrip.scrollLeft = 0;

    const temps = slice.map((s) => s.temp);
    el.hourlyNote.textContent =
      temps.length
        ? temp(Math.min(...temps)) + " to " + temp(Math.max(...temps))
        : "";

    drawChart(slice);
  }

  /** A small area + line chart of the next 24 hours, drawn as SVG. */
  function drawChart(slice) {
    const svg = el.hourlyChart;
    const NS = "http://www.w3.org/2000/svg";

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (slice.length < 2) return;

    const W = 600;
    const H = 74;
    const padY = 16;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    const temps = slice.map((s) => s.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const span = max - min || 1;

    const x = (i) => (i / (slice.length - 1)) * W;
    const y = (t) => H - padY - ((t - min) / span) * (H - padY * 2);

    const points = slice.map((s, i) => [x(i), y(s.temp)]);

    // Smooth path through the points
    let line = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      const mx = (px + cx) / 2;
      line += ` C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`;
    }

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML =
      '<linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="currentColor" stop-opacity="0.34"/>' +
      '<stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
      "</linearGradient>";
    svg.appendChild(defs);

    const area = document.createElementNS(NS, "path");
    area.setAttribute("d", `${line} L ${W} ${H} L 0 ${H} Z`);
    area.setAttribute("fill", "url(#chartFill)");
    svg.appendChild(area);

    const stroke = document.createElementNS(NS, "path");
    stroke.setAttribute("d", line);
    stroke.setAttribute("fill", "none");
    stroke.setAttribute("stroke", "currentColor");
    stroke.setAttribute("stroke-width", "2.5");
    stroke.setAttribute("stroke-linecap", "round");
    stroke.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(stroke);

    // Mark the warmest and coolest hours
    for (const extreme of [
      { value: max, index: temps.indexOf(max), dy: -6 },
      { value: min, index: temps.indexOf(min), dy: 14 },
    ]) {
      const cx = x(extreme.index);
      const cy = y(extreme.value);

      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", "currentColor");
      svg.appendChild(dot);

      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", Math.min(Math.max(cx, 18), W - 18));
      text.setAttribute("y", cy + extreme.dy);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-weight", "700");
      text.setAttribute("fill", "currentColor");
      text.textContent = temp(extreme.value);
      svg.appendChild(text);
    }

    svg.style.color = "var(--accent)";
    svg.setAttribute(
      "aria-label",
      "Temperature over the next 24 hours, from " +
        temp(min, true) +
        " to " +
        temp(max, true)
    );
  }

  function renderDaily() {
    const d = state.data.daily;
    const frag = document.createDocumentFragment();

    // One shared scale so the bars are comparable across the week
    const weekMin = Math.min(...d.temperature_2m_min);
    const weekMax = Math.max(...d.temperature_2m_max);
    const weekSpan = weekMax - weekMin || 1;

    for (let i = 0; i < d.time.length; i++) {
      const labels = dayLabels(d.time[i], i);
      const lo = d.temperature_2m_min[i];
      const hi = d.temperature_2m_max[i];
      const pop = d.precipitation_probability_max[i];

      const li = document.createElement("li");
      li.className = "day";

      // Name
      const name = document.createElement("span");
      name.className = "day-name";
      name.appendChild(document.createTextNode(labels.primary));
      const small = document.createElement("small");
      small.textContent = labels.secondary;
      name.appendChild(small);

      // Icon
      const icon = document.createElement("span");
      icon.className = "day-icon";
      icon.innerHTML = iconSvg(d.weather_code[i], true);

      // Range
      const range = document.createElement("div");
      range.className = "range";

      const loEl = document.createElement("span");
      loEl.className = "range-lo";
      loEl.textContent = temp(lo);

      const track = document.createElement("div");
      track.className = "range-track";
      const fill = document.createElement("div");
      fill.className = "range-fill";
      fill.style.marginLeft = ((lo - weekMin) / weekSpan) * 100 + "%";
      fill.style.width = Math.max(((hi - lo) / weekSpan) * 100, 6) + "%";
      track.appendChild(fill);

      const hiEl = document.createElement("span");
      hiEl.className = "range-hi";
      hiEl.textContent = temp(hi);

      range.append(loEl, track, hiEl);

      // Rain chance
      const popEl = document.createElement("span");
      popEl.className = "day-pop";
      if (pop !== null && pop >= 20) {
        popEl.innerHTML =
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3z"/></svg>';
        popEl.appendChild(document.createTextNode(pop + "%"));
      }

      li.append(name, icon, range, popEl);
      li.setAttribute(
        "aria-label",
        labels.primary +
          ", " +
          describe(d.weather_code[i]).label +
          ", high " +
          temp(hi, true) +
          ", low " +
          temp(lo, true)
      );
      frag.appendChild(li);
    }

    el.dailyList.replaceChildren(frag);
    el.dailyNote.textContent = state.data.timezone_abbreviation || "";
  }

  /* ───────────── Suggestions ───────────── */

  function renderSuggestions(results) {
    state.suggestions = results;
    state.activeSuggestion = -1;

    if (!results.length) {
      hideSuggestions();
      return;
    }

    const frag = document.createDocumentFragment();

    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "suggestion";
      li.id = "suggestion-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.index = String(i);

      const flag = document.createElement("span");
      flag.className = "suggestion-flag";
      flag.textContent = flagOf(r.country_code);

      const text = document.createElement("span");
      text.className = "suggestion-text";

      const name = document.createElement("span");
      name.className = "suggestion-name";
      name.textContent = r.name;

      const meta = document.createElement("span");
      meta.className = "suggestion-meta";
      meta.textContent = [r.admin1, r.country].filter(Boolean).join(", ");

      text.append(name, meta);
      li.append(flag, text);
      frag.appendChild(li);
    });

    el.suggestions.replaceChildren(frag);
    el.suggestions.hidden = false;
    el.input.setAttribute("aria-expanded", "true");
  }

  function hideSuggestions() {
    el.suggestions.hidden = true;
    el.suggestions.replaceChildren();
    el.input.setAttribute("aria-expanded", "false");
    el.input.removeAttribute("aria-activedescendant");
    state.suggestions = [];
    state.activeSuggestion = -1;
  }

  function moveActive(delta) {
    const items = [...el.suggestions.children];
    if (!items.length) return;

    const next =
      (state.activeSuggestion + delta + items.length + 1) % (items.length + 1);
    state.activeSuggestion = next === items.length ? -1 : next;

    items.forEach((item, i) => {
      const on = i === state.activeSuggestion;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-selected", String(on));
      if (on) {
        el.input.setAttribute("aria-activedescendant", item.id);
        // Guarded: not every engine implements scrollIntoView options.
        if (typeof item.scrollIntoView === "function") {
          item.scrollIntoView({ block: "nearest" });
        }
      }
    });

    if (state.activeSuggestion === -1) el.input.removeAttribute("aria-activedescendant");
  }

  async function requestSuggestions(query) {
    if (geoAbort) geoAbort.abort();
    geoAbort = new AbortController();

    try {
      const results = await geocode(query, geoAbort.signal);
      // Ignore a response that arrived after the box was emptied.
      if (el.input.value.trim().length < 2) return;
      renderSuggestions(results);
    } catch (err) {
      if (err.name !== "AbortError") hideSuggestions();
    }
  }

  /* ───────────── Recents ───────────── */

  function rememberPlace(place) {
    const key = (p) => p.latitude.toFixed(3) + "," + p.longitude.toFixed(3);
    state.recents = [
      place,
      ...state.recents.filter((p) => key(p) !== key(place)),
    ].slice(0, MAX_RECENTS);

    writeStore(RECENTS_KEY, state.recents);
    renderRecents();
  }

  function renderRecents() {
    if (!state.recents.length) {
      el.recents.hidden = true;
      return;
    }

    const frag = document.createDocumentFragment();

    state.recents.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.dataset.recent = String(i);
      btn.append(
        document.createTextNode(flagOf(p.country_code) + " " + p.name)
      );
      btn.setAttribute("aria-label", "Show weather for " + placeLabel(p));
      frag.appendChild(btn);
    });

    el.recentsList.replaceChildren(frag);
    el.recents.hidden = false;
  }

  function renderQuickCities() {
    const frag = document.createDocumentFragment();

    QUICK_CITIES.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.dataset.quick = String(i);
      btn.textContent = flagOf(p.country_code) + " " + p.name;
      frag.appendChild(btn);
    });

    el.quickCities.replaceChildren(frag);
  }

  /* ───────────── Geolocation ───────────── */

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast("This browser cannot share your location");
      return;
    }

    el.geoBtn.classList.add("is-busy");
    announce("Finding your location");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        el.geoBtn.classList.remove("is-busy");
        const { latitude, longitude } = pos.coords;

        // Open-Meteo has no reverse geocoder, so name the spot from the
        // timezone the forecast reports (e.g. Asia/Kathmandu → Kathmandu).
        await loadPlace({
          name: "Your location",
          country: "",
          admin1: "",
          latitude,
          longitude,
          country_code: null,
        });

        if (state.data && state.data.timezone) {
          const city = state.data.timezone.split("/").pop().replace(/_/g, " ");
          state.place.name = city;
          state.place.admin1 = "Your location";
          el.placeName.textContent = city;
          el.placeMeta.textContent =
            "Your location · " + state.data.timezone.replace(/_/g, " ");
          writeStore(LAST_KEY, state.place);
        }
      },
      (err) => {
        el.geoBtn.classList.remove("is-busy");
        const messages = {
          1: "Location permission was denied. Search for a city instead.",
          2: "Your location is unavailable right now.",
          3: "Finding your location took too long.",
        };
        toast(messages[err.code] || "Could not get your location");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  /* ───────────── Theme & units ───────────── */

  function applyTheme(theme) {
    el.html.dataset.theme = theme;
    el.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    if (el.themeMeta) {
      el.themeMeta.setAttribute("content", theme === "dark" ? "#080c16" : "#0ea5e9");
    }
  }

  function initTheme() {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* ignore */
    }
    const systemDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored === "dark" || stored === "light" ? stored : systemDark ? "dark" : "light");
  }

  function toggleTheme() {
    const next = el.html.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function setUnit(unit) {
    if (state.unit === unit) return;
    state.unit = unit;

    el.unitC.classList.toggle("is-active", unit === "c");
    el.unitF.classList.toggle("is-active", unit === "f");
    el.unitC.setAttribute("aria-pressed", String(unit === "c"));
    el.unitF.setAttribute("aria-pressed", String(unit === "f"));

    writeStore(UNIT_KEY, unit);
    if (state.data) renderAll(); // conversion only, no refetch
    announce(unit === "f" ? "Showing Fahrenheit" : "Showing Celsius");
  }

  /* ───────────── Events ───────────── */

  function bind() {
    // Search input
    el.input.addEventListener("input", () => {
      const q = el.input.value.trim();
      el.clearInput.hidden = q === "";

      clearTimeout(suggestTimer);
      if (q.length < 2) {
        hideSuggestions();
        return;
      }
      suggestTimer = setTimeout(() => requestSuggestions(q), 220);
    });

    el.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });

    el.form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // An arrow-key highlighted suggestion wins over a fresh lookup.
      if (state.activeSuggestion >= 0 && state.suggestions[state.activeSuggestion]) {
        pick(state.suggestions[state.activeSuggestion]);
        return;
      }

      const q = el.input.value.trim();
      if (!q) {
        el.input.focus();
        return;
      }

      hideSuggestions();
      showView("loading");

      try {
        if (geoAbort) geoAbort.abort();
        geoAbort = new AbortController();
        const results = await geocode(q, geoAbort.signal);

        if (!results.length) {
          showError(
            "No place called “" + q + "”",
            "Check the spelling, or try adding a country — “Springfield, US”."
          );
          return;
        }
        pick(results[0]);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!navigator.onLine) {
          showError("You are offline", "Reconnect to the internet and try again.");
        } else {
          showError("Search failed", "The place lookup did not respond. Please try again.");
        }
      }
    });

    el.clearInput.addEventListener("click", () => {
      el.input.value = "";
      el.clearInput.hidden = true;
      hideSuggestions();
      el.input.focus();
    });

    // Suggestion clicks
    el.suggestions.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion");
      if (!item) return;
      const r = state.suggestions[Number(item.dataset.index)];
      if (r) pick(r);
    });

    // Close the dropdown on an outside click
    document.addEventListener("click", (e) => {
      if (!el.suggestions.hidden && !e.target.closest(".search-field")) {
        hideSuggestions();
      }
    });

    // Recents & quick cities
    el.recentsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recent]");
      if (btn) loadPlace(state.recents[Number(btn.dataset.recent)]);
    });

    el.quickCities.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quick]");
      if (btn) loadPlace(QUICK_CITIES[Number(btn.dataset.quick)]);
    });

    el.geoBtn.addEventListener("click", useMyLocation);

    el.retryBtn.addEventListener("click", () => {
      if (state.place) loadPlace(state.place);
      else {
        showView("welcome");
        el.input.focus();
      }
    });

    el.unitC.addEventListener("click", () => setUnit("c"));
    el.unitF.addEventListener("click", () => setUnit("f"));
    el.themeToggle.addEventListener("click", toggleTheme);

    // Redraw the chart when the box changes size
    if (window.ResizeObserver) {
      let raf;
      new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (state.data) renderHourly();
        });
      }).observe(el.hourlyChart);
    }

    // Shortcuts
    document.addEventListener("keydown", (e) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.isContentEditable);
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        el.input.focus();
        el.input.select();
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleTheme();
      } else if (e.key.toLowerCase() === "u") {
        e.preventDefault();
        setUnit(state.unit === "c" ? "f" : "c");
      }
    });

    window.addEventListener("online", () => {
      if (state.place && el.result.hidden) loadPlace(state.place);
    });
  }

  function pick(result) {
    el.input.value = result.name;
    el.clearInput.hidden = false;
    hideSuggestions();
    loadPlace({
      name: result.name,
      country: result.country || "",
      admin1: result.admin1 || "",
      latitude: result.latitude,
      longitude: result.longitude,
      country_code: result.country_code || null,
    });
  }

  /* ───────────── Boot ───────────── */

  function init() {
    initTheme();

    const savedUnit = readStore(UNIT_KEY, "c");
    if (savedUnit === "f") {
      state.unit = "f";
      el.unitC.classList.remove("is-active");
      el.unitF.classList.add("is-active");
      el.unitC.setAttribute("aria-pressed", "false");
      el.unitF.setAttribute("aria-pressed", "true");
    }

    const recents = readStore(RECENTS_KEY, []);
    state.recents = Array.isArray(recents)
      ? recents.filter(
          (p) =>
            p &&
            typeof p.name === "string" &&
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude)
        )
      : [];

    renderRecents();
    renderQuickCities();
    bind();

    // Reopen on the place last viewed.
    const last = readStore(LAST_KEY, null);
    if (last && Number.isFinite(last.latitude) && Number.isFinite(last.longitude)) {
      el.input.value = last.name === "Your location" ? "" : last.name;
      el.clearInput.hidden = el.input.value === "";
      loadPlace(last);
    } else {
      showView("welcome");
    }
  }

  init();
})();
