# Agri-Risk Map Burning — Update 2569

## Data QA
- Source: `2026-6-15 HS2026.xlsx`
- Province: กำแพงเพชร
- LandType: พื้นที่เกษตร
- Period: 1 Jan–31 May 2026
- Output: 513 points
- Duplicate hsID removed: 0
- Outside province removed: 0
- District/subdistrict canonicalized by point-in-polygon against `subdistrict_kpt.geojson`.

## Risk model
Rolling 3-year Model A (2567–2569): Hotspot 40%, Trend 20%, Crop 20%, Area 20%. Risk is computed dynamically in `js/map.js`, and the same `risk_score` is used by the map and dashboard table.

## Visitor counter
The built-in counter is a per-device fallback because GitHub Pages has no database. For a global counter, set `CONFIG.VISITOR_COUNTER.endpoint` to an HTTPS JSON endpoint returning `count` or `value`.
