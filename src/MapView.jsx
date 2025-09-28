// src/MapView.jsx
import * as React from 'react';
import { Map, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// US border geo json from: https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_500k.json
// exclude: Alaska, Hawaii, Puerto Rico

export default function MapView({ onSelect, resetToHome }) {
  // 管理標記狀態和地圖引用
  const [clickMarker, setClickMarker] = React.useState(null);
  const mapRef = React.useRef(null);

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
        zoom: 10,
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

    // 如果沒點到監測站，檢查是否點擊到州
    const stateFeature = features.find(f => f.layer.id === 'us-fill');
    if (stateFeature) {
      const { lng, lat } = event.lngLat;
      const stateName = stateFeature.properties.NAME || 'Unknown State';

      if (onSelect) {
        onSelect({ lng, lat, stateName, isStation: false });
      }
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

      {/* OpenAQ 監測站 */}
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

      {/* Pandora 監測站 */}
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

      {/* TOLNet 監測站 */}
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

      {/* 點擊標記 */}
      {clickMarker && (
        <>
          {/* 30公里半徑圓圈 */}
          <Source
            id="radius-circle"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [createCircle([clickMarker.lng, clickMarker.lat], 30)]
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