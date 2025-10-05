// src/MapView.jsx
import * as React from 'react';
import { Map, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ml-station-animation.css'; // 導入 ML 站點動畫樣式
import { getAssetPath } from './lib/constants.js';

// US border geo json from: https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_500k.json
// exclude: Alaska, Hawaii, Puerto Rico

export default function MapView({ onSelect, resetToHome, showTempoLayer, showOpenAQLayer, showPandoraLayer, currentZoom, onZoomChange, mapRef }) {
  // 管理標記狀態和地圖引用
  const [clickMarker, setClickMarker] = React.useState(null);
  const internalMapRef = React.useRef(null);
  
  // 動畫狀態
  const [animationTime, setAnimationTime] = React.useState(0);

  // 使用外部傳入的 mapRef 或內部的 ref
  const actualMapRef = mapRef || internalMapRef;

  // 動畫循環
  React.useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(prev => prev + 0.1);
    }, 100); // 每100ms更新一次

    return () => clearInterval(interval);
  }, []);

  // 計算動畫數值
  const getAnimatedOpacity = (phase, offset = 0) => {
    const cycle = (animationTime + offset) % 3; // 3秒循環
    if (cycle < 1.5) {
      return Math.max(0.05, 0.4 - cycle * 0.2); // 從0.4降到0.1
    } else {
      return Math.max(0.05, (cycle - 1.5) * 0.2 + 0.1); // 從0.1升到0.4
    }
  };

  const getAnimatedRadius = (baseSize, amplitude, offset = 0) => {
    const cycle = (animationTime + offset) % 3;
    return baseSize + Math.sin(cycle * 2 * Math.PI) * amplitude;
  };

  // 添加地圖載入事件監聽器
  const handleMapLoad = () => {
    console.log('🗺️ Map loaded successfully');
    
    if (actualMapRef.current) {
      const map = actualMapRef.current;
      
      // 監聽地圖縮放變化
      map.on('zoom', () => {
        if (onZoomChange) {
          onZoomChange(map.getZoom());
        }
      });
      
      // 監聽 TEMPO NO₂ 圖層的載入事件
      map.on('sourcedata', (e) => {
        if (e.sourceId === 'tempo-no2') {
          if (e.isSourceLoaded) {
            console.log('🛰️ TEMPO NO₂ source loaded successfully');
          }
          if (e.tile) {
            console.log(`📡 TEMPO NO₂ tile loaded: ${e.tile.tileID.canonical.z}/${e.tile.tileID.canonical.x}/${e.tile.tileID.canonical.y}`);
          }
        }
      });

      // 監聽圖層錯誤
      map.on('error', (e) => {
        console.error('❌ Map error:', e);
        if (e.sourceId === 'tempo-no2') {
          console.error('❌ TEMPO NO₂ source error:', e.error);
        }
      });

      // 監聽 tile 載入錯誤
      map.on('styleimagemissing', (e) => {
        console.error('❌ Style image missing:', e.id);
      });

      // 監聽 source 載入錯誤
      map.on('data', (e) => {
        if (e.sourceId === 'tempo-no2' && e.sourceDataType === 'tiles') {
          console.log('📊 TEMPO NO₂ tiles data event:', e);
        }
      });

      // 監聽 tile 錯誤
      map.on('sourcedataloading', (e) => {
        if (e.sourceId === 'tempo-no2') {
          console.log('⏳ TEMPO NO₂ source loading...');
        }
      });
    }
  };

  // 初始視角設定
  const initialViewState = { longitude: -95.7, latitude: 37.1, zoom: 3.6 };

  // 創建30公里半徑圓形的函數
  const createCircle = (center, radiusInKm = 30) => {
    const points = 64; // 圓形的點數
    const coords = [];
    const distanceX = radiusInKm / (111.32 * Math.cos(center[1] * Math.PI / 180));
    const distanceY = radiusInKm / 110.54;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]); // 閉合圓形

    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coords]
      },
      properties: {}
    };
  };

  // 計算兩點之間的距離（公里）
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 從 TEMPO tiles 獲取 NO2 數值的函數
  // 獲取 TEMPO 數據的實際觀測時間
  const getTEMPOObservationTime = async () => {
    try {
      // 從 NASA CMR API 獲取最新的 TEMPO 檔案資訊
      const response = await fetch('https://cmr.earthdata.nasa.gov:443/search/granules.json?echo_collection_id=C3685668637-LARC_CLOUD&sort_key=-start_date&page_size=1');
      const data = await response.json();
      
      if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
        const latestEntry = data.feed.entry[0];
        
        // 從 links 中找到 title
        if (latestEntry.links && latestEntry.links.length > 0) {
          const title = latestEntry.links[0].title;
          
          // 從檔案名稱解析時間 (格式: TEMPO_NO2_L3_NRT_V02_20251002T133140Z_S004.nc)
          const timeMatch = title.match(/(\d{8}T\d{6}Z)/);
          if (timeMatch) {
            const timeString = timeMatch[1];
            // 轉換為 ISO 格式: 20251002T133140Z -> 2025-10-02T13:31:40Z
            const isoString = timeString.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
            return new Date(isoString);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching TEMPO observation time from CMR API:', error);
    }
    
    // 如果 API 失敗，返回預設值
    const fallbackTimeString = '2025-10-02T13:31:40Z';
    return new Date(fallbackTimeString);
  };

  const getTEMPOValue = async (lng, lat, zoom = 8) => {
    try {
      // 計算對應的 tile 座標
      const tileZ = Math.min(zoom, 8); // 最大 zoom 是 8
      const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, tileZ));
      const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, tileZ));
      
      // 構建 tile URL
      const tileUrl = `${window.location.origin}${getAssetPath('/tempo/tiles')}/${tileZ}/${tileX}/${tileY}.png`;
      
      // 計算在 tile 內的像素位置
      const tileSize = 256;
      const pixelX = Math.floor(((lng + 180) / 360 * Math.pow(2, tileZ) - tileX) * tileSize);
      const pixelY = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, tileZ) - tileY) * tileSize);
      
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            // 創建 canvas 來讀取像素數據
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // 獲取指定像素的 RGBA 值
            const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
            const [r, g, b, a] = imageData.data;
            
            // 如果是透明像素，表示沒有數據
            if (a === 0) {
              resolve(null);
              return;
            }
            
            // 根據顏色映射估算 NO2 濃度
            // 這是基於我們之前設定的顏色映射的反向計算
            const intensity = (r + g + b) / 3; // 簡化的強度計算
            const normalizedValue = intensity / 255;
            
            // 假設數據範圍是 0 到 5e15 molecules/cm²
            const estimatedValue = normalizedValue * 5e15;
            
            // 獲取實際觀測時間
            getTEMPOObservationTime().then(observationTime => {
              resolve({
                value: estimatedValue,
                unit: 'molecules/cm²',
                coordinates: { lng, lat },
                tileInfo: { z: tileZ, x: tileX, y: tileY, pixelX, pixelY },
                rgba: { r, g, b, a },
                observationTime: observationTime, // TEMPO 實際觀測時間
                dataType: 'TEMPO NO2'
              });
            }).catch(error => {
              console.error('Error getting observation time:', error);
              // 如果獲取時間失敗，仍然返回數據但沒有時間
              resolve({
                value: estimatedValue,
                unit: 'molecules/cm²',
                coordinates: { lng, lat },
                tileInfo: { z: tileZ, x: tileX, y: tileY, pixelX, pixelY },
                rgba: { r, g, b, a },
                dataType: 'TEMPO NO2'
              });
            });
          } catch (error) {
            console.error('Error reading pixel data:', error);
            resolve(null);
          }
        };
        
        img.onerror = () => {
          console.log('TEMPO tile not found or failed to load');
          resolve(null);
        };
        
        img.src = tileUrl;
      });
    } catch (error) {
      console.error('Error getting TEMPO value:', error);
      return null;
    }
  };
  
  // 單位轉換函式
  const convertO3ToPPM = (value, unit) => {
    if (!value || !unit) return value;
    const unitLower = unit.toLowerCase();
    if (unitLower.includes('ppm') && !unitLower.includes('ppb')) return value;
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 1960; // μg/m³ to ppm for O3 (1 ppm = 1960 μg/m³)
    }
    if (unitLower.includes('ppb')) return value / 1000;
    return value;
  };

  const convertSO2ToPPB = (value, unit) => {
    if (!value || !unit) return value;
    const unitLower = unit.toLowerCase();
    if (unitLower.includes('ppb')) return value;
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 2.62; // μg/m³ to ppb for SO2
    }
    if (unitLower.includes('ppm')) return value * 1000;
    return value;
  };

  const convertNO2ToPPB = (value, unit) => {
    if (!value || !unit) return value;
    const unitLower = unit.toLowerCase();
    if (unitLower.includes('ppb')) return value;
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 1.88; // μg/m³ to ppb for NO2
    }
    if (unitLower.includes('ppm')) return value * 1000;
    return value;
  };

  // 根據污染物類型格式化數值顯示精度
  const formatPollutantValue = (value, paramName) => {
    if (typeof value !== 'number' || isNaN(value)) return value;
    
    // NO2、SO2、PM10、PM2.5、CO 顯示到小數點後第一位
    if (['no2', 'so2', 'pm10', 'pm25', 'co'].includes(paramName)) {
      return value.toFixed(1);
    }
    
    // O3 顯示到小數點後第三位
    if (paramName === 'o3') {
      return value.toFixed(3);
    }
    
    // 其他情況預設顯示到第二位
    return value.toFixed(2);
  };

  const findNearbyStationsData = async (clickLat, clickLng, radiusKm = 10) => {
    try {
      // 獲取所有 OpenAQ 監測站的 GeoJSON 數據
      const openaqResponse = await fetch(getAssetPath('/data/openaq-us-stations.geojson'));
      const openaqData = await openaqResponse.json();

      // 獲取所有 Pandora 監測站的 GeoJSON 數據
      const pandoraResponse = await fetch(getAssetPath('/data/pandora-us-stations.geojson'));
      const pandoraData = await pandoraResponse.json();

      // 找出範圍內的 OpenAQ 監測站
      const nearbyOpenAQStations = openaqData.features.filter(feature => {
        const [stationLng, stationLat] = feature.geometry.coordinates;
        const distance = calculateDistance(clickLat, clickLng, stationLat, stationLng);
        return distance <= radiusKm;
      });

      // 找出範圍內的 Pandora 監測站
      const nearbyPandoraStations = pandoraData.features.filter(feature => {
        const [stationLng, stationLat] = feature.geometry.coordinates;
        const distance = calculateDistance(clickLat, clickLng, stationLat, stationLng);
        return distance <= radiusKm;
      });

      console.log(`Found ${nearbyOpenAQStations.length} OpenAQ stations within ${radiusKm}km`);
      console.log(`Found ${nearbyPandoraStations.length} Pandora stations within ${radiusKm}km`);

      // 目標污染物
      const targetParameters = ['pm25', 'pm10', 'o3', 'co', 'so2', 'no2'];
      const pollutantData = {};

      // 初始化污染物數據結構
      targetParameters.forEach(param => {
        pollutantData[param] = {
          values: [],
          max: null,
          stations: [],
          unit: null
        };
      });

            // OpenAQ API key
      const API_KEY = 'f842213920405091f23318ca1a7880636ac843b7cb81f8e3985c41b17deb19f2';

      // 收集所有 OpenAQ 監測站的 sensor 資料並獲取即時數據
      for (const station of nearbyOpenAQStations) {
        let sensors = station.properties.sensors || [];
        
        // 確保 sensors 是陣列
        if (typeof sensors === 'string') {
          try {
            sensors = JSON.parse(sensors);
          } catch (error) {
            console.error('Failed to parse sensors:', error);
            continue;
          }
        }

        // 遍歷該監測站的所有 sensors
        for (const sensor of sensors) {
          const paramName = sensor.parameter_name?.toLowerCase();
          if (targetParameters.includes(paramName)) {
            try {
              // 檢查是否在開發環境（有 proxy）還是生產環境
              const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              const apiUrl = isDevelopment 
                ? `/api/openaq/v3/sensors/${sensor.id}` // 開發環境使用 proxy
                : `https://cors-anywhere.herokuapp.com/https://api.openaq.org/v3/sensors/${sensor.id}`; // 生產環境使用 CORS Anywhere
              
              const response = await fetch(apiUrl, {
                headers: {
                  'x-api-key': API_KEY
                }
              });

              if (response.ok) {
                const result = await response.json();
                const sensorData = result.results[0];
                const latestValue = sensorData?.latest?.value;

                if (latestValue !== null && latestValue !== undefined) {
                  // 進行單位轉換
                  let convertedValue = latestValue;
                  let convertedUnit = sensor.parameter_units;
                  
                  if (paramName === 'o3') {
                    convertedValue = convertO3ToPPM(latestValue, sensor.parameter_units);
                    convertedUnit = 'ppm';
                  } else if (paramName === 'so2') {
                    convertedValue = convertSO2ToPPB(latestValue, sensor.parameter_units);
                    convertedUnit = 'ppb';
                  } else if (paramName === 'no2') {
                    convertedValue = convertNO2ToPPB(latestValue, sensor.parameter_units);
                    convertedUnit = 'ppb';
                  }
                  
                  pollutantData[paramName].values.push(convertedValue);
                  pollutantData[paramName].stations.push({
                    stationName: station.properties.name,
                    sensorId: sensor.id,
                    unit: convertedUnit,
                    value: convertedValue,
                    originalValue: latestValue,
                    originalUnit: sensor.parameter_units,
                    timestamp: sensorData?.latest?.datetime?.local
                  });

                  if (!pollutantData[paramName].unit) {
                    pollutantData[paramName].unit = convertedUnit;
                  }
                }
              } else {
                console.error(`Failed to fetch data for sensor ${sensor.id}:`, response.status);
              }
            } catch (error) {
              console.error(`Error fetching sensor ${sensor.id} (likely CORS or network issue):`, error);
              
              // 如果直接 API 調用失敗，嘗試使用 sensor 中可能存在的歷史數據
              if (sensor.latest_value !== null && sensor.latest_value !== undefined) {
                console.log(`Using fallback data for sensor ${sensor.id}`);
                
                let convertedValue = sensor.latest_value;
                let convertedUnit = sensor.parameter_units;
                
                if (paramName === 'o3') {
                  convertedValue = convertO3ToPPM(sensor.latest_value, sensor.parameter_units);
                  convertedUnit = 'ppm';
                } else if (paramName === 'so2') {
                  convertedValue = convertSO2ToPPB(sensor.latest_value, sensor.parameter_units);
                  convertedUnit = 'ppb';
                } else if (paramName === 'no2') {
                  convertedValue = convertNO2ToPPB(sensor.latest_value, sensor.parameter_units);
                  convertedUnit = 'ppb';
                }
                
                pollutantData[paramName].values.push(convertedValue);
                pollutantData[paramName].stations.push({
                  stationName: station.properties.name,
                  sensorId: sensor.id,
                  unit: convertedUnit,
                  value: convertedValue,
                  originalValue: sensor.latest_value,
                  originalUnit: sensor.parameter_units,
                  timestamp: sensor.latest_datetime || 'Historical data',
                  note: 'Fallback data - API unavailable'
                });

                if (!pollutantData[paramName].unit) {
                  pollutantData[paramName].unit = convertedUnit;
                }
              }
            }
          }
        }
      }

      // 處理 Pandora 監測站數據
      // Pandora 主要測量大氣柱 NO2 和 O3
      for (const pandoraStation of nearbyPandoraStations) {
        const stationName = pandoraStation.properties.station;
        const instrument = pandoraStation.properties.instrument;
        
        console.log(`Processing Pandora station: ${stationName} (${instrument})`);
        
        try {
          // 檢查是否在開發環境（有 proxy）還是生產環境
          const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const pandoraApiUrl = isDevelopment 
            ? `/api/pandora/${stationName}/${instrument}/L2/${instrument}_${stationName}_L2_rnvh3p1-8.txt` // 開發環境使用 proxy
            : `https://cors-anywhere.herokuapp.com/https://data.hetzner.pandonia-global-network.org/${stationName}/${instrument}/L2/${instrument}_${stationName}_L2_rnvh3p1-8.txt`; // 生產環境使用 CORS Anywhere

          console.log(`Fetching Pandora data from: ${pandoraApiUrl}`);
          const response = await fetch(pandoraApiUrl);
          
          if (response.ok) {
            const text = await response.text();
            const lines = text.trim().split('\n');
            const tail = lines.slice(-5);

            let lastDataLine = null;
            for (let i = tail.length - 1; i >= 0; i--) {
              const line = tail[i].trim();
              if (/^\d{8}T\d{6}/.test(line)) { // 符合時間戳格式 20250920T233650
                lastDataLine = line;
                break;
              }
            }

            if (lastDataLine) {
              const cols = lastDataLine.split(/\s+/);
              const timestamp = cols[0];
              const no2_value = cols[56]; // NO2 柱濃度
              const isoTimestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(9, 11)}:${timestamp.slice(11, 13)}:${timestamp.slice(13, 15)}Z`;

              if (no2_value && no2_value !== 'null' && !isNaN(Number(no2_value))) {
                const no2_column = Number(no2_value); // 單位: mol/m³ 或其他
                
                // 將 Pandora NO2 柱濃度轉換為地表濃度 (ppb) 用於 AQI 計算
                // 注意：Pandora 的單位可能與 TEMPO 不同，需要適當轉換
                
                // 假設 Pandora 的 NO2 數據單位是 mol/m³，需要轉換為 molecules/cm²
                // 這個轉換需要根據實際的 Pandora 數據格式來調整
                const no2_molecules_cm2 = no2_column * 6.022e23 * 1e-4; // 簡化轉換
                
                if (no2_molecules_cm2 > 0) {
                  // 使用與 TEMPO 相同的轉換邏輯
                  const AVOGADRO = 6.022e23;
                  const PRESSURE_SURFACE = 1013.25;
                  const TEMPERATURE_SURFACE = 288.15;
                  const MIXING_HEIGHT = 1.5e5;
                  const SHAPE_FACTOR = 0.7;
                  
                  const volumeDensity = (no2_molecules_cm2 * SHAPE_FACTOR) / MIXING_HEIGHT;
                  const airDensity = (PRESSURE_SURFACE * 100) / (1.38e-16 * TEMPERATURE_SURFACE);
                  const no2_ppb = (volumeDensity / airDensity) * 1e9;
                  
                  if (no2_ppb > 0) {
                    pollutantData.no2.values.push(no2_ppb);
                    pollutantData.no2.stations.push({
                      stationName: stationName,
                      stationId: `pandora_${stationName}`,
                      unit: 'ppb',
                      value: no2_ppb,
                      originalValue: no2_column,
                      originalUnit: 'mol/m³',
                      timestamp: isoTimestamp,
                      source: 'pandora'
                    });
                    
                    if (!pollutantData.no2.unit) {
                      pollutantData.no2.unit = 'ppb';
                    }
                    
                    console.log(`Pandora ${stationName} NO2: ${no2_column} mol/m³ → ${no2_ppb.toFixed(2)} ppb`);
                  }
                }
              }
            } else {
              console.log(`No recent data found for Pandora station ${stationName}`);
            }
          } else {
            console.error(`Failed to fetch Pandora data for ${stationName}:`, response.status);
          }
          
        } catch (error) {
          console.error(`Error fetching Pandora data for ${stationName}:`, error);
        }
      }

      // 計算每種污染物的最大值
      targetParameters.forEach(param => {
        if (pollutantData[param].values.length > 0) {
          pollutantData[param].max = Math.max(...pollutantData[param].values);
        }
      });

      return {
        nearbyStationsCount: nearbyOpenAQStations.length + nearbyPandoraStations.length,
        openaqStationsCount: nearbyOpenAQStations.length,
        pandoraStationsCount: nearbyPandoraStations.length,
        pollutantData,
        radiusKm
      };

    } catch (error) {
      console.error('Error finding nearby stations:', error);
      return {
        nearbyStationsCount: 0,
        pollutantData: {},
        radiusKm
      };
    }
  };

  // 重置到首頁視角的函數
  React.useEffect(() => {
    if (resetToHome && actualMapRef.current) {
      // 清除點擊標記和圓圈
      setClickMarker(null);
      // 平滑飛行回到初始視角
      actualMapRef.current.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        duration: 2000, // 2秒動畫
        essential: true
      });
    }
  }, [resetToHome]);

  // 檢查 TEMPO tiles URL 並記錄調試信息
  React.useEffect(() => {
    const tilesUrl = `${window.location.origin}${getAssetPath('/tempo/tiles')}/{z}/{x}/{y}.png`;
    console.log('🔗 TEMPO tiles URL pattern:', tilesUrl);
    
    // 測試多個具體的 tile URL
    const testTileUrls = [
      `${window.location.origin}${getAssetPath('/tempo/tiles')}/4/2/10.png`,
      `${window.location.origin}${getAssetPath('/tempo/tiles')}/3/1/5.png`,
      `${window.location.origin}${getAssetPath('/tempo/tiles')}/5/4/20.png`
    ];
    
    testTileUrls.forEach(testTileUrl => {
      console.log('🧪 Testing tile URL:', testTileUrl);
      
      // 嘗試載入一個測試 tile
      fetch(testTileUrl)
        .then(response => {
          if (response.ok) {
            console.log('✅ Test tile loaded successfully:', testTileUrl);
            
            // 檢查是否是有效的圖片
            return response.blob();
          } else {
            console.error('❌ Test tile failed to load:', response.status, testTileUrl);
          }
        })
        .then(blob => {
          if (blob && blob.type.startsWith('image/')) {
            console.log('✅ Test tile is valid image:', blob.type, blob.size, 'bytes');
            
            // 嘗試創建 Image 對象來測試解碼
            const img = new Image();
            img.onload = () => {
              console.log('✅ Test tile decoded successfully:', img.width, 'x', img.height);
            };
            img.onerror = (error) => {
              console.error('❌ Test tile decode error:', error);
            };
            img.src = URL.createObjectURL(blob);
          } else if (blob) {
            console.error('❌ Test tile is not an image:', blob.type);
          }
        })
        .catch(error => {
          console.error('❌ Test tile fetch error:', error, testTileUrl);
        });
    });
  }, []);

  const handleMapClick = (event) => {
    const { lng, lat } = event.lngLat;

    const features = event.target.queryRenderedFeatures(event.point, {
      layers: ['us-fill', 'openaq-us-stations-points', 'ml-station-main', 'ml-station-center', 'pandora-us-stations-points'] // 加入所有可點擊的 ML 圖層
    });

    // 檢查是否點擊在美國境內（包括監測站或州區域）
    const isInUSA = features.some(f => 
      f.layer.id === 'us-fill' || 
      f.layer.id === 'openaq-us-stations-points' || 
      f.layer.id === 'ml-station-main' ||
      f.layer.id === 'ml-station-center' ||
      f.layer.id === 'pandora-us-stations-points'
    );

    // 如果點擊位置不在美國境內，就不執行任何操作
    if (!isInUSA) {
      return;
    }

    // 設定紅色標記位置
    setClickMarker({ lng, lat });

    // 不論點擊到什麼地方都要放大（僅限美國境內）
    if (actualMapRef.current) {
      actualMapRef.current.flyTo({
        center: [lng, lat],
        zoom: 9,
        duration: 2000, // 2秒動畫
        essential: true
      });
    }

    // 優先檢查是否點擊到監測站（包括一般站點和 ML 站點）
    const stationFeature = features.find(f => 
      f.layer.id === 'openaq-us-stations-points' || 
      f.layer.id === 'ml-station-main' ||
      f.layer.id === 'ml-station-center'
    );
    if (stationFeature) {
      const { lng, lat } = event.lngLat;
      const stationName = stationFeature.properties.name;
      const provider = stationFeature.properties.provider;
      const timezone = stationFeature.properties.timezone;
      let sensors = stationFeature.properties.sensors || []; // 取得 sensors 資料

      // 確保 sensors 是陣列，如果是字串則解析 JSON
      if (typeof sensors === 'string') {
        try {
          sensors = JSON.parse(sensors);
        } catch (error) {
          console.error('Failed to parse sensors from GeoJSON:', error);
          sensors = [];
        }
      }

      console.log('Station clicked:', stationName, 'Sensors:', sensors); // Debug 用
      console.log('Sensors type in MapView:', typeof sensors, 'Is array:', Array.isArray(sensors)); // Debug

      if (onSelect) {
        onSelect({
          lng,
          lat,
          stateName: 'Air Quality Station',
          stationName,
          provider,
          timezone,
          sensors, // 傳遞 sensors 資料
          isStation: true,
          stationType: 'OpenAQ',
          type: 'openaq' // 添加 type 屬性供 InfoPanel 使用
        });
      }
      return;
    }

    // 檢查是否點擊到 Pandora 監測站
    const pandoraFeature = features.find(f => f.layer.id === 'pandora-us-stations-points');
    if (pandoraFeature) {
      console.log(pandoraFeature);
      const { lng, lat } = event.lngLat;
      const stationName = pandoraFeature.properties.station || 'Unknown Station';
      const instrument = pandoraFeature.properties.instrument || 'Unknown Instrument';

      console.log('lng, lat:', lng, lat);
      console.log('Pandora Station clicked:', stationName, 'Instrument:', instrument);

      if (onSelect) {
        onSelect({
          lng,
          lat,
          stationName,
          instrument,
          isStation: true,
          type: 'pandora'
        });
      }
      return;
    }

    // 如果沒點到監測站，檢查是否點擊到州或其他區域
    const stateFeature = features.find(f => f.layer.id === 'us-fill');
    if (stateFeature || !stationFeature) {
      const { lng, lat } = event.lngLat;
      const stateName = stateFeature?.properties.NAME || 'Unknown Location';

      // 先顯示加載狀態
      if (onSelect) {
        onSelect({ 
          lng, 
          lat, 
          stateName, 
          isStation: false,
          nearbyStationsData: null,
          loadingNearbyData: true,
          tempoData: null,
          loadingTempoData: true
        });
      }

      // 同時獲取10公里範圍內的監測站數據和 TEMPO 數據
      Promise.all([
        findNearbyStationsData(lat, lng, 10),
        getTEMPOValue(lng, lat)
      ]).then(([nearbyData, tempoValue]) => {
        if (onSelect) {
          onSelect({ 
            lng, 
            lat, 
            stateName, 
            isStation: false,
            nearbyStationsData: nearbyData,
            loadingNearbyData: false,
            tempoData: tempoValue,
            loadingTempoData: false
          });
        }
      });
    }
  };

  return (
    <Map
      ref={actualMapRef}
      initialViewState={initialViewState}
      style={{ width: "100vw", height: "100vh" }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      maxBounds={[
        [-150, 15], // SW
        [-65, 57],  // NE
      ]}
      minZoom={3}
      maxZoom={15}
      onClick={handleMapClick}
      onLoad={handleMapLoad}
    >
      {/* 把 us-states.geojson 加進來 */}
      <Source id="us-states" type="geojson" data={getAssetPath("/data/us-states.geojson")} />

      <Source id="world-mask" type="geojson" data={getAssetPath("/data/world-mask.geojson")} />
      <Layer
        id="mask"
        type="fill"
        source="world-mask"
        paint={{
          "fill-color": "#000000",
          "fill-opacity": 0.15
        }}
      />

      <Source id="us-states" type="geojson" data={getAssetPath("/data/us-states.geojson")} />
      <Layer
        id="us-fill"
        type="fill"
        source="us-states"
        paint={{
          "fill-color": "#ffffff",
          "fill-opacity": 0.35
        }}
      />
      <Layer
        id="us-borders"
        type="line"
        source="us-states"
        paint={{
          "line-color": "#7c7c7cff",
          "line-width": 1
        }}
      />

      {/* TEMPO NO₂ Satellite Data - 條件顯示 */}
      {showTempoLayer && (
        <>
          <Source
            id="tempo-no2"
            type="raster"
            tiles={[
              `${window.location.origin}${getAssetPath('/tempo/tiles')}/{z}/{x}/{y}.png`
            ]}
            tileSize={256}
            minzoom={2}
            maxzoom={8}
            scheme="xyz"
          />
          <Layer
            id="tempo-no2-layer"
            type="raster"
            source="tempo-no2"
            paint={{
              "raster-opacity": 0.07,  // 大幅降低透明度，讓地圖資訊更清楚
              "raster-fade-duration": 300,
              "raster-brightness-max": 1.0,
              "raster-brightness-min": 0.0,
              "raster-contrast": 0.7,
              "raster-saturation": 0.7  // 降低飽和度，讓顏色更柔和
            }}
          />
        </>
      )}

      {/* OpenAQ 監測站 - 條件顯示 */}
      {showOpenAQLayer && (
        <>
          <Source id="openaq-us-stations" type="geojson" data={getAssetPath("/data/openaq-us-stations.geojson")} />
          
          {/* 一般監測站 (排除 id 221) */}
          <Layer
            id="openaq-us-stations-points"
            type="circle"
            source="openaq-us-stations"
            filter={["!=", ["get", "id"], 221]} // 排除 id 221
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 3,
                8, 6,
                15, 12
              ],
              "circle-color": "#8B5CF6",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 1,
              "circle-opacity": 0.8
            }}
          />
          
          {/* 特殊站點 (id 221) - 最大外圈 */}
          <Layer
            id="ml-station-ripple-largest"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 40 + Math.sin(animationTime * 1.5) * 10,
                8, 65 + Math.sin(animationTime * 1.5) * 15,
                15, 90 + Math.sin(animationTime * 1.5) * 20
              ],
              "circle-color": "#EF4444",
              "circle-opacity": Math.max(0.05, 0.15 + Math.sin(animationTime * 2) * 0.1),
              "circle-stroke-width": 1,
              "circle-stroke-color": "#EF4444",
              "circle-stroke-opacity": Math.max(0.1, 0.25 + Math.sin(animationTime * 2) * 0.15)
            }}
          />
          
          {/* 特殊站點 (id 221) - 大外圈 */}
          <Layer
            id="ml-station-ripple-large"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 28 + Math.sin(animationTime * 1.8 + 1) * 8,
                8, 45 + Math.sin(animationTime * 1.8 + 1) * 12,
                15, 65 + Math.sin(animationTime * 1.8 + 1) * 15
              ],
              "circle-color": "#EF4444",
              "circle-opacity": Math.max(0.08, 0.2 + Math.sin(animationTime * 2.2 + 1) * 0.12),
              "circle-stroke-width": 1,
              "circle-stroke-color": "#EF4444",
              "circle-stroke-opacity": Math.max(0.15, 0.3 + Math.sin(animationTime * 2.2 + 1) * 0.15)
            }}
          />
          
          {/* 特殊站點 (id 221) - 中外圈 */}
          <Layer
            id="ml-station-ripple-medium"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 18 + Math.sin(animationTime * 2.1 + 2) * 6,
                8, 30 + Math.sin(animationTime * 2.1 + 2) * 8,
                15, 42 + Math.sin(animationTime * 2.1 + 2) * 12
              ],
              "circle-color": "#EF4444",
              "circle-opacity": Math.max(0.1, 0.25 + Math.sin(animationTime * 2.5 + 2) * 0.15),
              "circle-stroke-width": 2,
              "circle-stroke-color": "#DC2626",
              "circle-stroke-opacity": Math.max(0.2, 0.4 + Math.sin(animationTime * 2.5 + 2) * 0.2)
            }}
          />
          
          {/* 特殊站點 (id 221) - 小外圈 */}
          <Layer
            id="ml-station-ripple-small"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 10 + Math.sin(animationTime * 2.4 + 3) * 4,
                8, 18 + Math.sin(animationTime * 2.4 + 3) * 6,
                15, 25 + Math.sin(animationTime * 2.4 + 3) * 8
              ],
              "circle-color": "#EF4444",
              "circle-opacity": Math.max(0.15, 0.3 + Math.sin(animationTime * 2.8 + 3) * 0.2),
              "circle-stroke-width": 2,
              "circle-stroke-color": "#DC2626",
              "circle-stroke-opacity": Math.max(0.25, 0.45 + Math.sin(animationTime * 2.8 + 3) * 0.25)
            }}
          />
          
          {/* 特殊站點 (id 221) - 主要圓圈 */}
          <Layer
            id="ml-station-main"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 6 + Math.sin(animationTime * 3) * 1,
                8, 10 + Math.sin(animationTime * 3) * 2,
                15, 16 + Math.sin(animationTime * 3) * 3
              ],
              "circle-color": "#DC2626",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 3,
              "circle-opacity": 0.8 + Math.sin(animationTime * 3) * 0.15
            }}
          />
          
          {/* 特殊站點 (id 221) - 中心高亮點 */}
          <Layer
            id="ml-station-center"
            type="circle"
            source="openaq-us-stations"
            filter={["==", ["get", "id"], 221]}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 3,
                8, 4,
                15, 6
              ],
              "circle-color": "#FFFFFF",
              "circle-opacity": 0.95
            }}
          />
        </>
      )}

      {/* Pandora 監測站 - 條件顯示 */}
      {showPandoraLayer && (
        <>
          <Source id="pandora-us-stations" type="geojson" data={getAssetPath("/data/pandora-us-stations.geojson")} />
          <Layer
            id="pandora-us-stations-points"
            type="circle"
            source="pandora-us-stations"
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 3,
                8, 6,
                15, 12
              ],
              "circle-color": "#0b204fff",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 1,
              "circle-opacity": 0.8
            }}
          />
        </>
      )}

      {/* 點擊標記 */}
      {clickMarker && (
        <>
          {/* 30公里半徑圓圈 */}
          <Source
            id="radius-circle"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [createCircle([clickMarker.lng, clickMarker.lat], 10)]
            }}
          >
            <Layer
              id="radius-circle-fill"
              type="fill"
              paint={{
                "fill-color": "#3B82F6",
                "fill-opacity": 0.1
              }}
            />
            <Layer
              id="radius-circle-stroke"
              type="line"
              paint={{
                "line-color": "#3B82F6",
                "line-width": 2,
                "line-opacity": 0.5
              }}
            />
          </Source>

          {/* 點擊標記點 */}
          <Source
            id="click-marker"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [clickMarker.lng, clickMarker.lat]
                },
                properties: {}
              }]
            }}
          >
          {/* 標記圓圈 */}
          <Layer
            id="click-marker-circle"
            type="circle"
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 5,
                8, 8,
                15, 14
              ],
              "circle-color": "#EF4444",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 2,
              "circle-opacity": 0.9
            }}
          />
          {/* 標記中心點 */}
          <Layer
            id="click-marker-center"
            type="circle"
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 1.5,
                8, 2,
                15, 3.5
              ],
              "circle-color": "#FFFFFF",
              "circle-opacity": 1
            }}
          />
          </Source>
        </>
      )}
    </Map>
  );
}