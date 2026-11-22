# NEXUS VILLAGE V5 — hospital & signage geometry fix

## Files changed
Only `src/components/Village3D.jsx` was modified relative to V4. All application screens, backend API service, scenario controls, results, simulation, and interiors remain unchanged.

## Exact changes
- Removed `Placard`, `BuildingSign`, `GroundSign` and their usages, including the small flag-base plaques; preserved Tunisia/Japan flags.
- Replaced the two pitched-roof `House` calls in `Hospital` with one white modern hospital block (9.6 × 6.3 world units), flat roof, double glass entry doors, multiple windows, entrance canopy, and flush red cross. Removed the adjacent decorative tower from the hospital composition.
- Roof slab runs from `y=4.38` to `y=4.64`, centered at `[3,4.51,0.5]`, dimensions `[9.72,0.26,6.42]`. Parapets sit on the slab.
- Rain shield hinge is at `[3,5.22,-1.15]`. The lowest solid canopy layer is above the parapet. Material is opaque `MeshPhysicalMaterial`, and the canopy geometry has top/bottom surfaces plus side walls.
- Opening angle: `0` deployed and `-1.2` folded upward. Collection pipe and separate non-potable tank are preserved and rerouted from the new roof.
- The hospital click-to-inspect surface and resource drop zone have been resized for the larger footprint.

## Run locally
```sh
npm install
npm run dev
```
Then open the Vite URL in your browser. Configurable backend remains `VITE_API_BASE_URL` in `.env`.

## Verification
Static integrity checks passed for removed signs and unchanged API/App/Interior3D files. Real browser rendering and `npm run build` could **not** be executed in this environment: npm registry lookup failed with `EAI_AGAIN`. Please compile and visually test locally before judging.
