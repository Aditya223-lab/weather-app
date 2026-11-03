# Weather — forecast at a glance

A clean weather app built with **plain HTML, CSS and JavaScript**. It uses the
[Open-Meteo](https://open-meteo.com/) API, which needs **no API key and no sign-up**,
so you can clone this and it works immediately.

**[▶ Live demo](https://aditya223-lab.github.io/weather-app/)**

---

## Features

**Finding a place**
- Type-ahead city search with country flags and region names, so you can tell
  Springfield, Illinois from Springfield, Missouri
- Arrow-key navigation through the suggestions
- "Use my location" button via the Geolocation API
- Your last five searches are kept as one-tap pills
- Reopens on the place you looked at last

**Current conditions**
- Temperature, what it feels like, and a plain-English description
- Animated weather icons that change between day and night
- Ten detail tiles: wind speed and direction, gusts, humidity, UV index,
  pressure, cloud cover, visibility, sunrise, sunset and rain chance
- The page's background colours shift to match the conditions — sunny, cloudy,
  rainy, snowy, stormy or night

**Forecasts**
- A 24-hour temperature curve drawn as an SVG chart, with the warmest and
  coolest hours marked
- A scrollable hour-by-hour strip with icons and rain probability
- A 7-day forecast where each day's temperature range is drawn on one shared
  scale, so you can compare days at a glance

**Quality of life**
- °C / °F toggle that also switches wind to mph and visibility to miles —
  converted locally, so switching never refetches
- Dark and light themes, following your system setting until you choose one
- Loading skeletons rather than a spinner, so the layout doesn't jump
- Specific error messages: a city that doesn't exist, an API error with its
  status code, and being offline are all reported differently
- Re-fetches automatically when you come back online

**Accessibility**
- The search box is a proper ARIA combobox with `aria-activedescendant`
- Every hour and day carries a readable `aria-label`
- Screen-reader announcements for loading, errors and unit changes
- Honours `prefers-reduced-motion` and `prefers-contrast`
- Responsive down to 320px, with a print stylesheet

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>/</kbd> | Jump to the search box |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through suggestions |
| <kbd>Enter</kbd> | Search, or pick the highlighted suggestion |
| <kbd>Esc</kbd> | Close the suggestions |
| <kbd>T</kbd> | Toggle dark / light theme |
| <kbd>U</kbd> | Switch between °C and °F |

---

## Running it

```bash
git clone https://github.com/Aditya223-lab/weather-app.git
cd weather-app
```

Open `index.html` in a browser and it works — no key, no install, no build.

One caveat: **"Use my location" needs a secure context.** Browsers only expose
the Geolocation API over `https://` or `localhost`, so if you open the file
directly as `file://`, that one button won't work. City search is unaffected.
To get it working locally:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

---

## The API

Two endpoints, both free and keyless:

**1. Geocoding** — turn a name into coordinates

```
https://geocoding-api.open-meteo.com/v1/search?name=Kathmandu&count=6&language=en&format=json
```

**2. Forecast** — turn coordinates into weather

```
https://api.open-meteo.com/v1/forecast
  ?latitude=27.7172&longitude=85.3240
  &current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,...
  &hourly=temperature_2m,weather_code,precipitation_probability,is_day,visibility
  &daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,...
  &timezone=auto&forecast_days=7
```

Everything is requested in metric once and converted in the browser, so the
°C/°F switch costs no network traffic.

Conditions arrive as [WMO weather codes](https://open-meteo.com/en/docs); all 28
of them are mapped to a label and an icon in the `WX` table in `script.js`.

---

## How the code is organised

```
index.html    Markup and the view containers
style.css     Design tokens → base → layout → components → responsive
script.js     All behaviour, in one IIFE
favicon.svg
```

A few decisions worth explaining:

- **Requests are cancellable.** Both lookups use `AbortController`, so typing
  quickly cannot leave an older response to land after a newer one and overwrite it.
- **API strings never reach `innerHTML`.** `innerHTML` is only ever assigned
  hard-coded icon markup from the constants at the top of the file; every value
  that comes from the network is inserted as a text node.
- **The "now" hour is matched against the location's clock,** not the browser's,
  using the `utc_offset_seconds` the API returns — so the hourly strip starts at
  the right hour when you look up a city in another timezone.
- **Open-Meteo has no reverse geocoder.** For "use my location" the place is
  named from the timezone the forecast reports (`Asia/Kathmandu` → Kathmandu),
  which avoids pulling in a second provider.
- **`localStorage` is wrapped in `try/catch`,** and corrupt stored data falls
  back to defaults instead of breaking the boot.

---

## Browser support

Works in current Chrome, Firefox, Safari and Edge. Uses `fetch`,
`AbortController`, `ResizeObserver`, CSS custom properties, `color-mix()`
and `backdrop-filter`.

---

## Credits

Weather data by [Open-Meteo](https://open-meteo.com/), free for non-commercial
use under CC BY 4.0. Icons are hand-drawn SVG in `script.js`.

## License

MIT — see [LICENSE](LICENSE).
