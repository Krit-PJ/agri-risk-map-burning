/**
 * risk.js — Risk scoring engine (M06)
 * Score 0–100: weighted sum of hotspot_frequency, repeat_burn, crop_type, weather
 */

const RiskModule = (() => {

  const W = CONFIG.RISK_WEIGHTS;

  /**
   * Compute risk score for a single district/area feature.
   * @param {object} params
   *   hotspot_count   - total hotspots in area (all years)
   *   repeat_count    - number of years with hotspot ≥ 1
   *   crop_type       - dominant crop string
   *   fire_weather    - fire weather index 0–1 (from external data; default 0.5)
   */
  function computeScore({ hotspot_count = 0, repeat_count = 0, crop_type = 'อื่นๆ', fire_weather = 0.5 } = {}) {
    // Normalize hotspot frequency (cap at 200 for 100%)
    const freq_score = Math.min(hotspot_count / 200, 1.0);

    // Repeat burn: years with hotspot / total years (5)
    const repeat_score = Math.min(repeat_count / 5, 1.0);

    // Crop multiplier
    const crop_score = CONFIG.CROP_RISK[crop_type] ?? CONFIG.CROP_RISK['อื่นๆ'];

    // Weather (provided externally 0–1)
    const weather_score = Math.min(Math.max(fire_weather, 0), 1);

    const raw = (
      freq_score    * W.hotspot_frequency +
      repeat_score  * W.repeat_burn +
      crop_score    * W.crop_type +
      weather_score * W.weather
    );

    return parseFloat((raw * 100).toFixed(1));
  }

  /**
   * Quick estimate from a single hotspot count (no other info).
   * Used in top-district table.
   */
  function scoreFromCount(count) {
    return computeScore({ hotspot_count: count, repeat_count: 3, crop_type: 'อื่นๆ', fire_weather: 0.5 });
  }

  /**
   * Get human-readable risk level object from score.
   */
  function getLevelFromScore(score) {
    return CONFIG.RISK_LEVELS.find(l => score >= l.min && score < l.max) || CONFIG.RISK_LEVELS[0];
  }

  /**
   * Score all features in a GeoJSON FeatureCollection and inject risk_score property.
   * Accepts aggregated district stats map: { districtKey → { hotspot_count, repeat_count, crop_type, fire_weather } }
   */
  function scoreAll(districtStatsMap, geojson) {
    const riskCounts = { low: 0, medium: 0, high: 0, very_high: 0 };
    const scored = {
      type: 'FeatureCollection',
      features: geojson.features.map(f => {
        const key = f.properties.AMP_NAM_T || f.properties.district || f.properties.name || '';
        const stats = districtStatsMap[key] || {};
        const score = computeScore(stats);
        const level = getLevelFromScore(score);

        // Tally
        if      (score < 25)  riskCounts.low++;
        else if (score < 50)  riskCounts.medium++;
        else if (score < 75)  riskCounts.high++;
        else                  riskCounts.very_high++;

        return {
          ...f,
          properties: { ...f.properties, risk_score: score, risk_level: level.label },
        };
      }),
    };

    // Update risk chart
    Dashboard.updateRiskChart(riskCounts);
    return scored;
  }

  /**
   * Aggregate hotspot features by district across multiple years.
   * Returns map: districtKey → { hotspot_count, repeat_count, crop_type, fire_weather }
   */
  function aggregateHotspots(hotspotsByYear) {
    const stats = {}; // key = district name

    Object.entries(hotspotsByYear).forEach(([year, features]) => {
      const yearHit = new Set();
      features.forEach(f => {
        const district = f.properties?.district || f.properties?.AMP_NAM_T || 'ไม่ระบุ';
        const crop     = f.properties?.crop_type || 'อื่นๆ';
        if (!stats[district]) {
          stats[district] = { hotspot_count: 0, repeat_count: 0, crop_type: crop, fire_weather: 0.5 };
        }
        stats[district].hotspot_count++;
        yearHit.add(district);
        // Keep most frequent crop (simple: last wins)
        stats[district].crop_type = crop;
      });
      // Increment repeat_count for districts seen this year
      yearHit.forEach(d => stats[d].repeat_count++);
    });

    return stats;
  }

  return { computeScore, scoreFromCount, getLevelFromScore, scoreAll, aggregateHotspots };
})();
