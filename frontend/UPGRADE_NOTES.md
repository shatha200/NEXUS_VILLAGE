# NEXUS Village v3 — visual upgrade

Preserves the original API field names and endpoints: /health, /scenarios, /simulate, /optimize. The Compare button now compares already saved human and NEXUS results locally, to respect the independent simulation workflow; /compare remains in nexusApi.js for legacy support.

## Differences from v2
- Click hospital or house to open an interactive *illustrative* interior inspection.
- Hospital facade carries a large bilingual label and emergency sign.
- Tunisian and Japanese flags on poles in the central square.
- Detailed procedural tree foliage, branches, shed leaves, olive rows and palms (no external 3D assets required).
- Dedicated temperature / water / energy / blackout / pump-failure visual behavior.
- Orbit camera supports drag, scroll zoom and right-button pan; trackpad two-finger scrolling zooms; drag rotates. Shift-pan depends on operating system mouse mapping.
- Human and NEXUS results remain separate and Compare uses saved results only.

**Limitations**: This is a high-detail *stylized* procedural village, not photorealistic scanned architecture. A photorealistic Foundation-grade game needs textured 3D assets, asset licenses and GPU optimization. Hospital and house interiors are non-graphic staged illustrations, NOT casualty predictions. The initial crisis preview uses illustrative local rules; real outcomes come from the backend.
