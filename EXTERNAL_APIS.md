# External APIs

The system integrates two third-party APIs. **Both are optional** — the server boots and runs in fallback mode without them.

---

## 1. TomTom Traffic API

Free tier: **2,500 calls/day**. No credit card required.

### Get the key

1. Open <https://developer.tomtom.com/> and click **Register** (top right).
2. Confirm the verification email.
3. Sign in. On the **Dashboard**, you already have a default key shown under **Your Keys**.
4. Copy the value next to **API Key**.

### Wire it up

In the repo-root `.env`:

```env
TOMTOM_API_KEY=<paste here>
```

Then in the running app: open *System → Configuration → External Provider* and toggle the provider to **Enabled**. The Command Center "External Traffic Context" card flips from `FALLBACK MODE` to `CONNECTED`.

### What we use it for

- **Flow segment data** (`/traffic/services/4/flowSegmentData`) — current vs. free-flow speed at the active zone's center.
- **Incident details** (`/traffic/services/5/incidentDetails`) — externally-reported incidents in the zone bounding box.

---

## 2. Open-Meteo (Weather)

**No signup. No API key. No credit card.** Free for non-commercial use (10,000 calls/day).

Open-Meteo is a non-profit, EU-based weather API. We chose it because it works out of the box — useful for demos, viva, and CI — with no key to leak.

### Wire it up

Nothing to do. As soon as the API server starts, the Weather Context card on the Command Center calls `https://api.open-meteo.com/v1/forecast?...` against the active zone's lat/lon and lights up.

If you ever want to point at a mirror or run offline, set `OPENMETEO_BASE_URL` in `.env`.

### What we use it for

- **Current conditions** (`/v1/forecast?...&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m`) — temp, feels-like, humidity, wind, weather code.
- **Visibility** from the first hourly slice (`hourly=visibility&forecast_hours=1`).
- We map the WMO `weather_code` (0–99) to a friendly condition string (Clear / Rain / Fog / Thunderstorm / Snow / etc.) and a derived severity (`CLEAR` / `MODERATE` / `POOR`).
- The severity bumps `/api/traffic-risk` overall risk: `POOR` raises one full level (LOW→MEDIUM→HIGH→CRITICAL); `MODERATE` raises a LOW risk to MEDIUM. Documented in the risk endpoint's `reasons` array.
- Responses are cached in-memory for 10 minutes — well under any rate limit.

### Why not OpenWeatherMap?

OpenWeatherMap also has a free tier, but it requires an account + key, and the activation delay (~10 min) plus their recently-broken signup flow makes it the wrong default for a teaching project that needs to "just run". Open-Meteo gives the same signal (temp, condition, severity) with zero friction.

---

## Fallback behavior

Without TomTom: the *External Traffic Context* card on the Command Center shows `FALLBACK MODE`.

If Open-Meteo is unreachable (rare; usually means no internet): the *Weather Context* card shows fallback mode and the system simply skips the weather-bump rule in the risk calculator.

This is intentional — the system must never refuse to operate just because a third-party API is unavailable.

---

## Security notes

- The TomTom key is read from `process.env` on the **server only**. Never sent to the browser.
- The `.env` file is gitignored by default.
- Open-Meteo has no key, so nothing to leak.
- If you accidentally commit the TomTom key, rotate it via the TomTom developer dashboard.
