// src/MapView.jsx
import * as React from 'react';
import { Map, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// US border geo json from: https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_500k.json
// exclude: Alaska, Hawaii, Puerto Rico

export default function MapView({ onSelect, resetToHome, showTempoLayer, showOpenAQLayer, showPandoraLayer, showTOLNetLayer }) {
  // 管理標記狀態和地圖引用
  const [clickMarker, setClickMarker] = React.useState(null);
  const mapRef = React.useRef(null);

  // 添加地圖載入事件監聽器
  const handleMapLoad = () => {
    console.log('🗺️ Map loaded successfully');
    
    if (mapRef.current) {
      const map = mapRef.current;
      
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
  const getTEMPOValue = async (lng, lat, zoom = 8) => {
    try {
      // 計算對應的 tile 座標
      const tileZ = Math.min(zoom, 8); // 最大 zoom 是 8
      const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, tileZ));
      const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, tileZ));
      
      // 構建 tile URL
      const tileUrl = `${window.location.origin}/tempo/tiles/${tileZ}/${tileX}/${tileY}.png`;
      
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
            
            resolve({
              value: estimatedValue,
              unit: 'molecules/cm²',
              coordinates: { lng, lat },
              tileInfo: { z: tileZ, x: tileX, y: tileY, pixelX, pixelY },
              rgba: { r, g, b, a }
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
  const findNearbyStationsData = async (clickLat, clickLng, radiusKm = 10) => {
    try {
      // 獲取所有 OpenAQ 監測站的 GeoJSON 數據
      const response = await fetch('/data/openaq-us-stations.geojson');
      const geojsonData = await response.json();

      // 找出範圍內的監測站
      const nearbyStations = geojsonData.features.filter(feature => {
        const [stationLng, stationLat] = feature.geometry.coordinates;
        const distance = calculateDistance(clickLat, clickLng, stationLat, stationLng);
        return distance <= radiusKm;
      });

      console.log(`Found ${nearbyStations.length} stations within ${radiusKm}km`);

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

      // 收集所有監測站的 sensor 資料並獲取即時數據
      for (const station of nearbyStations) {
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
              // 調用 OpenAQ API 獲取即時數據
              const response = await fetch(`/api/openaq/v3/sensors/${sensor.id}`, {
                headers: {
                  'x-api-key': API_KEY
                }
              });

              if (response.ok) {
                const result = await response.json();
                const sensorData = result.results[0];
                const latestValue = sensorData?.latest?.value;

                if (latestValue !== null && latestValue !== undefined) {
                  pollutantData[paramName].values.push(latestValue);
                  pollutantData[paramName].stations.push({
                    stationName: station.properties.name,
                    sensorId: sensor.id,
                    unit: sensor.parameter_units,
                    value: latestValue,
                    timestamp: sensorData?.latest?.datetime?.local
                  });

                  if (!pollutantData[paramName].unit) {
                    pollutantData[paramName].unit = sensor.parameter_units;
                  }
                }
              } else {
                console.error(`Failed to fetch data for sensor ${sensor.id}:`, response.status);
              }
            } catch (error) {
              console.error(`Error fetching sensor ${sensor.id}:`, error);
            }
          }
        }
      }

      // 計算每種污染物的最大值
      targetParameters.forEach(param => {
        if (pollutantData[param].values.length > 0) {
          pollutantData[param].max = Math.max(...pollutantData[param].values);
        }
      });

      return {
        nearbyStationsCount: nearbyStations.length,
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
    if (resetToHome && mapRef.current) {
      // 清除點擊標記和圓圈
      setClickMarker(null);
      // 平滑飛行回到初始視角
      mapRef.current.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        duration: 2000, // 2秒動畫
        essential: true
      });
    }
  }, [resetToHome]);

  // 檢查 TEMPO tiles URL 並記錄調試信息
  React.useEffect(() => {
    const tilesUrl = `${window.location.origin}/tempo/tiles/{z}/{x}/{y}.png`;
    console.log('🔗 TEMPO tiles URL pattern:', tilesUrl);
    
    // 測試多個具體的 tile URL
    const testTileUrls = [
      `${window.location.origin}/tempo/tiles/4/2/10.png`,
      `${window.location.origin}/tempo/tiles/3/1/5.png`,
      `${window.location.origin}/tempo/tiles/5/4/20.png`
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
      layers: ['us-fill', 'openaq-us-stations-points', 'pandora-us-stations-points'] // 只查詢這兩個圖層, 
    });

    // 檢查是否點擊在美國境內（包括監測站或州區域）
    const isInUSA = features.some(f => 
      f.layer.id === 'us-fill' || 
      f.layer.id === 'openaq-us-stations-points' || 
      f.layer.id === 'pandora-us-stations-points'
    );

    // 如果點擊位置不在美國境內，就不執行任何操作
    if (!isInUSA) {
      return;
    }

    // 設定紅色標記位置
    setClickMarker({ lng, lat });

    // 不論點擊到什麼地方都要放大（僅限美國境內）
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 9,
        duration: 2000, // 2秒動畫
        essential: true
      });
    }

    // 優先檢查是否點擊到監測站
    const stationFeature = features.find(f => f.layer.id === 'openaq-us-stations-points');
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
          stationType: 'OpenAQ'
        });
      }
      return;
    }
    
    // 檢查是否點擊到 Pandora 監測站
    const pandoraFeature = features.find(f => f.layer.id === 'pandora-stations-points');
    if (pandoraFeature) {
      const { lng, lat } = event.lngLat;
      const stationName = pandoraFeature.properties.station;
      const instrument = pandoraFeature.properties.instrument;
      const provider = 'Pandora';
      
      console.log('Pandora station clicked:', stationName, 'Instrument:', instrument); // Debug 用
      
      if (onSelect) {
        onSelect({ 
          lng, 
          lat, 
          stateName: 'Pandora Station',
          stationName,
          provider,
          instrument, // 傳遞 instrument 資訊
          timezone: null, // Pandora 資料沒有 timezone
          sensors: [], // Pandora 站點沒有即時 sensors 資料
          isStation: true,
          stationType: 'Pandora'
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
      ref={mapRef}
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
      <Source id="us-states" type="geojson" data="/data/us-states.geojson" />

      <Source id="world-mask" type="geojson" data="/data/world-mask.geojson" />
      <Layer
        id="mask"
        type="fill"
        source="world-mask"
        paint={{
          "fill-color": "#000000",
          "fill-opacity": 0.15
        }}
      />

      <Source id="us-states" type="geojson" data="/data/us-states.geojson" />
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
              `${window.location.origin}/tempo/tiles/{z}/{x}/{y}.png`
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
          <Source id="openaq-us-stations" type="geojson" data="/data/openaq-us-stations.geojson" />
          <Layer
            id="openaq-us-stations-points"
            type="circle"
            source="openaq-us-stations"
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
        </>
      )}

      {/* Pandora 監測站 - 條件顯示 */}
      {showPandoraLayer && (
        <>
          <Source id="pandora-us-stations" type="geojson" data="/data/pandora-us-stations.geojson" />
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

      {/* TOLNet 監測站 - 條件顯示 */}
      {showTOLNetLayer && (
        <>
          <Source id="TOLNet-us-stations" type="geojson" data="/data/TOLnet-us-stations.geojson" />
          <Layer
            id="TOLNet-us-stations-points"
            type="circle"
            source="TOLNet-us-stations"
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, 3,
                8, 6,
                15, 12
              ],
              "circle-color": "#a8d36cff",
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