// src/App.jsx
import * as React from 'react';
import MapView from './MapView';
import InfoPanel from './InfoPanel';

export default function App() {
  const [selection, setSelection] = React.useState(null);
  // selection: { lng, lat, stateName } | null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* 地圖：把點擊結果丟回來 */}
      <MapView onSelect={setSelection} />

      {/* 右側資訊面板（浮在地圖上） */}
      <InfoPanel
        open={!!selection}
        data={selection}
        onClose={() => setSelection(null)}
      />

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: '20px',
          padding: '2.5px 10px',
          fontSize: '12px',
          color: '#374151',
          fontWeight: '500',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 5,
          whiteSpace: 'nowrap'
        }}
      >
        68332@Taichung NASA Hackathon 2025
      </div>
    </div>
  );
}