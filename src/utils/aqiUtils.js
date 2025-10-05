// AQI 計算工具函數
export const calculateAQI = (pollutants) => {
  // AQI 轉換表 (美國 EPA 標準)
  const aqiBreakpoints = {
    pm25: [
      { lo: 0, hi: 12, aqiLo: 0, aqiHi: 50 },
      { lo: 12.1, hi: 35.4, aqiLo: 51, aqiHi: 100 },
      { lo: 35.5, hi: 55.4, aqiLo: 101, aqiHi: 150 },
      { lo: 55.5, hi: 150.4, aqiLo: 151, aqiHi: 200 },
      { lo: 150.5, hi: 250.4, aqiLo: 201, aqiHi: 300 },
      { lo: 250.5, hi: 350.4, aqiLo: 301, aqiHi: 400 },
      { lo: 350.5, hi: 500.4, aqiLo: 401, aqiHi: 500 }
    ],
    pm10: [
      { lo: 0, hi: 54, aqiLo: 0, aqiHi: 50 },
      { lo: 55, hi: 154, aqiLo: 51, aqiHi: 100 },
      { lo: 155, hi: 254, aqiLo: 101, aqiHi: 150 },
      { lo: 255, hi: 354, aqiLo: 151, aqiHi: 200 },
      { lo: 355, hi: 424, aqiLo: 201, aqiHi: 300 },
      { lo: 425, hi: 504, aqiLo: 301, aqiHi: 400 },
      { lo: 505, hi: 604, aqiLo: 401, aqiHi: 500 }
    ],
    o3: [
      { lo: 0, hi: 0.054, aqiLo: 0, aqiHi: 50 },
      { lo: 0.055, hi: 0.070, aqiLo: 51, aqiHi: 100 },
      { lo: 0.071, hi: 0.085, aqiLo: 101, aqiHi: 150 },
      { lo: 0.086, hi: 0.105, aqiLo: 151, aqiHi: 200 },
      { lo: 0.106, hi: 0.200, aqiLo: 201, aqiHi: 300 }
    ],
    co: [
      { lo: 0, hi: 4.4, aqiLo: 0, aqiHi: 50 },
      { lo: 4.5, hi: 9.4, aqiLo: 51, aqiHi: 100 },
      { lo: 9.5, hi: 12.4, aqiLo: 101, aqiHi: 150 },
      { lo: 12.5, hi: 15.4, aqiLo: 151, aqiHi: 200 },
      { lo: 15.5, hi: 30.4, aqiLo: 201, aqiHi: 300 },
      { lo: 30.5, hi: 40.4, aqiLo: 301, aqiHi: 400 },
      { lo: 40.5, hi: 50.4, aqiLo: 401, aqiHi: 500 }
    ],
    so2: [
      { lo: 0, hi: 35, aqiLo: 0, aqiHi: 50 },
      { lo: 36, hi: 75, aqiLo: 51, aqiHi: 100 },
      { lo: 76, hi: 185, aqiLo: 101, aqiHi: 150 },
      { lo: 186, hi: 304, aqiLo: 151, aqiHi: 200 },
      { lo: 305, hi: 604, aqiLo: 201, aqiHi: 300 },
      { lo: 605, hi: 804, aqiLo: 301, aqiHi: 400 },
      { lo: 805, hi: 1004, aqiLo: 401, aqiHi: 500 }
    ],
    no2: [
      { lo: 0, hi: 53, aqiLo: 0, aqiHi: 50 },
      { lo: 54, hi: 100, aqiLo: 51, aqiHi: 100 },
      { lo: 101, hi: 360, aqiLo: 101, aqiHi: 150 },
      { lo: 361, hi: 649, aqiLo: 151, aqiHi: 200 },
      { lo: 650, hi: 1249, aqiLo: 201, aqiHi: 300 },
      { lo: 1250, hi: 1649, aqiLo: 301, aqiHi: 400 },
      { lo: 1650, hi: 2049, aqiLo: 401, aqiHi: 500 }
    ]
  };

  const calculateSingleAQI = (concentration, pollutant) => {
    const breakpoints = aqiBreakpoints[pollutant];
    
    if (!breakpoints || concentration === null || concentration === undefined) {
      return null;
    }

    for (const bp of breakpoints) {
      if (concentration >= bp.lo && concentration <= bp.hi) {
        const aqi = Math.round(
          ((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (concentration - bp.lo) + bp.aqiLo
        );
        return aqi;
      }
    }
    return null;
  };

  let maxAqi = 0;
  let dominantPollutant = '';
  const individualAqis = {};

  Object.entries(pollutants).forEach(([pollutant, data]) => {
    if (data.max !== null && data.max !== undefined) {
      const aqi = calculateSingleAQI(data.max, pollutant);
      if (aqi !== null) {
        individualAqis[pollutant] = aqi;
        if (aqi > maxAqi) {
          maxAqi = aqi;
          dominantPollutant = pollutant;
        }
      }
    }
  });

  return maxAqi > 0 ? { aqi: maxAqi, dominantPollutant, individualAqis } : null;
};

// AQI 顏色和類別
export const getAQIInfo = (aqi) => {
  if (aqi <= 50) return { level: 'Good', color: '#00E400', textColor: '#000000' };
  if (aqi <= 100) return { level: 'Moderate', color: '#FFFF00', textColor: '#000000' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#FF7E00', textColor: '#000000' };
  if (aqi <= 200) return { level: 'Unhealthy', color: '#FF0000', textColor: '#FFFFFF' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: '#8F3F97', textColor: '#FFFFFF' };
  return { level: 'Hazardous', color: '#7E0023', textColor: '#FFFFFF' };
};

// 重要監測站點定義 (與MapView.jsx保持一致)
export const FEATURED_STATIONS = [
  {
    id: 739,
    name: "McMillan Reservoir",
    coordinates: [-77.013176, 38.921848]
  },
  {
    id: 162,
    name: "Houston Deer Park C3",
    coordinates: [-95.128508, 29.670025]
  },
  {
    id: 1226,
    name: "Grand Rapids",
    coordinates: [-85.67109700000002, 42.984699]
  },
  {
    id: 2183,
    name: "Denver - CAMP",
    coordinates: [-104.987198, 39.751099]
  },
  {
    id: 1938,
    name: "Seattle-Beacon Hill",
    coordinates: [-122.308628, 47.568236000000006]
  },
  {
    id: 605,
    name: "Phoenix JLG Supersit",
    coordinates: [-112.09500100000001, 33.503601]
  },
  {
    id: 448,
    name: "Boston - Roxbury",
    coordinates: [-71.082497, 42.329399]
  },
  {
    id: 221,
    name: "Indpls-Washington Pa",
    coordinates: [-86.114444, 39.810833]
  },
  {
    id: 7936,
    name: "Los Angeles - N. Mai",
    coordinates: [-118.22675500000001, 34.066429]
  },
  {
    id: 2135,
    name: "Oakland West",
    coordinates: [-122.28240200000002, 37.8148]
  }
];