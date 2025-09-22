// src/MapView.jsx
import * as React from 'react';
import { Map, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css'; 

// US border geo json from: https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_500k.json
// exclude: Alaska, Hawaii, Puerto Rico

export default function MapView({ onSelect }) {
  // 管理標記狀態
  const [clickMarker, setClickMarker] = React.useState(null);
  const handleMapClick = (event) => {
    const { lng, lat } = event.lngLat;
    
    // 設定紅色標記位置
    setClickMarker({ lng, lat });
    
    const features = event.target.queryRenderedFeatures(event.point, {
      layers: ['us-fill', 'us-stations-points']
    });
    
    // 優先檢查是否點擊到監測站
    const stationFeature = features.find(f => f.layer.id === 'us-stations-points');
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
          isStation: true
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
      initialViewState={{ longitude: -95.7, latitude: 37.1, zoom: 3.6 }}
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
        <Source id="us-stations" type="geojson" data="/data/openaq-us-stations.geojson" />
        <Layer
        id="us-stations-points"
        type="circle"
        source="us-stations"
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

        {/* 點擊標記 */}
        {clickMarker && (
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
                  3, 8,
                  8, 12,
                  15, 20
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
                  3, 2,
                  8, 3,
                  15, 5
                ],
                "circle-color": "#FFFFFF",
                "circle-opacity": 1
              }}
            />
          </Source>
        )}
    </Map>
  );
}