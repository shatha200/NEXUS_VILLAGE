# NEXUS VILLAGE — Frontend v2 (stylized 3D village)

Same API contract as v1: GET /health, GET /scenarios, POST /simulate, POST /optimize, POST /compare.

## Run
    npm install
    cp .env.example .env      (Windows: copy .env.example .env)
    npm run dev               -> http://localhost:5173

Edit `.env` to point to the FastAPI backend (local or ngrok HTTPS URL).

## Files
- src/App.jsx                 UI: crisis drawer, token distribution (drag and drop), NEXUS tab, compare, 24h playback
- src/components/Village3D.jsx   3D village: Zone 1 hospital + houses, Zone 2 water source + pumps + energy, Zone 3 agriculture + irrigation
- src/components/Logo.jsx        Nexus logo (hexagon, leaves, sun, roots as circuit)
- src/services/nexusApi.js       unchanged from v1
- src/styles.css                 dark brand theme

## How it works
1. CRISIS tab: pick a default case or change the sliders, then SIMULATE CRISIS (visual estimate, no decisions).
2. DISTRIBUTE tab: drag blue (water) and yellow (energy) coins onto the zones, then SIMULATE MY DISTRIBUTION (POST /simulate).
3. NEXUS tab: OPTIMIZE WITH NEXUS (POST /optimize). The recommended coins appear in the zones and the village plays the 24h outcome.
4. COMPARE tab: POST /compare after both runs.

Energy dropped on the agriculture zone is added to pump_energy, because the backend delivers irrigation water through the pump.
