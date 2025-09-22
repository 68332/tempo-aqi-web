// src/MapView.jsx
import * as React from 'react';
import { Map, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css'; 

// US border geo json from: https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_500k.json
// exclude: Alaska, Hawaii, Puerto Rico

export default function MapView() {
  return (
    <Map
      initialViewState={{ longitude: -95.7, latitude: 37.1, zoom: 3.6 }}
      style={{ width: "100vw", height: "100vh" }}
      mapStyle="https://tiles.openfreemap.org/styles/bright"
      maxBounds={[
        [-130, 20], // SW
        [-65, 52],  // NE
      ]}
      minZoom={4}
      maxZoom={15}
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
            "fill-opacity": 0.17
        }}
        />

        <Source id="us-states" type="geojson" data="/data/us-states.geojson" />
        <Layer
        id="us-fill"
        type="fill"
        source="us-states"
        paint={{
            "fill-color": "#ffffff",
            "fill-opacity": 0.25
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
    </Map>
  );
}