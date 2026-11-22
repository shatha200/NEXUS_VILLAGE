# NEXUS VILLAGE V9 — Clickable Backup Storage

This project is based on the existing V8 source and keeps its trained models, notebook, backend routes, human/NEXUS/compare workflow, rainfall shield, and all backend dependencies unchanged.

## What changed

- A large **BACKUP STORAGE** depot in the 3D village, near the western agricultural/infrastructure edge. Click the building to inspect the **last completed simulation**, or use the BACKUP STORAGE shortcut at the lower left.
- The old backup-resource summary has been removed from the **Crisis** control panel.
- The depot displays four distinct values: remaining reservoir water (blue tokens), remaining usable energy (yellow tokens), 24h solar production and potential battery storage (kWh), and separate non-potable rainwater storage (liters) plus experimental raindrop energy (Wh).
- Run **Simulate Crisis** to calculate the backup snapshot. The backend's trained solar prediction model is attempted automatically; if unavailable, a clearly labeled **theoretical panel estimate** is used. The trained model is for a different, synthetic reference village and its `×0.002` mapping to this tabletop model is explicitly hypothetical.
- Solar production is **not automatically added again** to the base electricity budget. If you explicitly apply the demonstrative solar credit, all prior Human/NEXUS decisions must be simulated again before comparing them. The maximum extra demo credit remains four 1-kWh tokens.
- Rain storage stays **0 L** until the user has forecast or selected a demo rain event and explicitly deployed the shield. The same is true of the tiny experimental impact-energy display.
- Tunisian flag was redrawn in the 3D canvas with white disc, red crescent and red five-point star. Japan flag preserved.
- Readability of the FIELD OVERVIEW/temperature panel is improved by a dark high-contrast backing.

## Running

### Python backend
```
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### React frontend
```
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL=http://localhost:8000`, or your active HTTPS ngrok domain. Set FastAPI CORS for the exact frontend browser origin as in the prior V8 instructions.

### Tests
```
cd backend && python -m pytest -q
cd frontend && node tests/test-api.mjs && node tests/test-behavior.mjs && node tests/test-checkpoint.mjs && node tests/test-storage.mjs
cd frontend && npm run build
```

## Scientific and operational honesty

- It is a **24h aggregate tabletop simulation**, not a real-time sensor or grid-management system.
- **Solar**: train-model output is for a larger synthetic village. We scale by 0.2% as a demonstrative visualization; alternatively, the frontend calculates a stated theoretical yield for 8 m² panels, which is NOT trained or calibrated. Both are potential production, with a 4-kWh assumed battery cap.
- **Rainwater**: calculated from rainfall depth, 42 m² area, 75% catch efficiency, and 650-L tank cap; not potable without treatment. No automatic conversion into 5,000-L water tokens.
- **Raindrops**: tiny theoretical mechanical/electrical energy, represented in watt-hours and never powering a hospital or generating energy tokens.
- The most recent **executed** crisis/human/NEXUS scenario is shown in storage. Changing form sliders alone does not create resources or update the last completed snapshot.
- This snapshot is a model visualization, not hardware measurements; no sensors are connected.

## Test status in creation environment

Backend: 26 tests passed (some scikit-learn version warnings due to environment; requirements file unchanged).
Frontend API, behavior, checkpoint, and new backup accounting tests: passed.
JSX parsing of modified React files: passed using Babel parser.
Full Vite browser rendering / mouse raycasting: not verified here (npm dependencies unavailable in the test environment). Please run `npm install`, `npm run build` and manually click the depot before the jury demo.
