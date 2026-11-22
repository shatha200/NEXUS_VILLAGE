# NEXUS VILLAGE — detailed frontend V4

This project is based on the uploaded NEXUS frontend V3. Existing FastAPI endpoints and JSON property names are kept intact.

## Launch

Requirements: Node.js 20+, npm. Open this folder in VS Code:

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows use `copy .env.example .env`. Set `VITE_API_BASE_URL` in `.env` to `http://localhost:8000` or your ngrok HTTPS URL. Open the URL printed by Vite. No model files or external visual assets are required.

## Controls

- Click+drag: orbit the 3D village. Two-finger swipe/scroll: zoom. Right-click drag: pan.
- Click hospital facade or house facade to inspect a new navigable 3D room with equipment and residents.
- CRISIS tab: modify scenario parameters, run the original visual-only crisis preview.
- DISTRIBUTE tab: assign blue water/yellow energy tokens and call `POST /simulate`.
- NEXUS tab: call `POST /optimize` and display calculated recommendations.
- COMPARE tab: compare saved Human and NEXUS results (no new backend call).
- CRISIS > NEXUS RAIN CAPTURE: try a backend weather model or load a labelled demonstration rain event and deploy the hospital's folding collector.

## Optional weather prediction backend contract

`POST /predict-weather` receives the **same** `scenario` JSON already used with `/optimize`.

Example valid response:

```json
{"rain_probability": 0.83, "precipitation_mm_24h": 12.0, "model_name": "your-model-version"}
```

The frontend also accepts `rain_probability_percent` (0–100) instead of `rain_probability` (0–1), and `rainfall_mm` instead of `precipitation_mm_24h`.

If the endpoint is unavailable, the app reports that the model is unavailable. The **LOAD DEMO RAIN EVENT** button explicitly selects a hypothetical rainfall input, not a prediction. Temperature, wind and pollution alone cannot justify an accurate rain forecast without an actual weather model and data.

## Rain capture: important scientific limits

- Collector area 42 m², runoff efficiency 0.75, emergency tank capacity 650 L.
- Stored litres = `min(rainfall_mm * 42 * 0.75, 650)` (1 mm rain / 1 m² = 1 L).
- Captured rainwater is **not potable without proper treatment/testing**; it is shown in a separate tank.
- Existing backend water tokens equal 5,000 L. Recovered litres are intentionally **not** added to the 5,000 L water-token optimizer. Do not add fractions of tokens or assume potable hospital use without changing the backend accounting.
- Rain-droplet energy harvesting: the 3D roof represents a research concept, **not** a source of meaningful hospital/pump energy. Energy credited to the backend is zero yellow tokens.
- The roof's deployment is a simulated mechanism; the project does not claim a real actuator or validated structural design.

## Reality & QA limitations

Buildings, foliage and interiors are detailed real-time procedural 3D with dynamic lights; they are not photorealistic licensed game assets or real patient motion-capture. The hospital shows simulated patient risk and power interruption, not confirmed deaths. Household signs indicate compromised supply; a 24-hour water shortage alone does not prove starvation.

Static JSX syntax checks passed. `npm install` in this environment timed out, so end-to-end Vite compilation and real browser/WebGL behavior could not be verified here. Run `npm run build` locally and test GPU performance; reduce shadows/dpr if needed.
