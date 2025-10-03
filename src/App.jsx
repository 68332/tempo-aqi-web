// src/App.jsx
import * as React from 'react';
import MapView from './MapView';
import InfoPanel from './InfoPanel';

export default function App() {
  const [selection, setSelection] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 900);
  const [resetToHome, setResetToHome] = React.useState(false);
  
  // 圖層顯示控制狀態
  const [showTempoLayer, setShowTempoLayer] = React.useState(true); // 控制 TEMPO NO2 圖層顯示
  const [showOpenAQLayer, setShowOpenAQLayer] = React.useState(true); // 控制 OpenAQ 監測站顯示
  const [showPandoraLayer, setShowPandoraLayer] = React.useState(true); // 控制 Pandora 監測站顯示
  
  // selection: { lng, lat, stateName } | null

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 處理重置到首頁
  const handleResetToHome = () => {
    setSelection(null);
    setResetToHome(true);
    // 重置標記，確保下次可以再次觸發
    setTimeout(() => setResetToHome(false), 100);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* 地圖：把點擊結果丟回來 */}
      <MapView 
        onSelect={setSelection} 
        resetToHome={resetToHome} 
        showTempoLayer={showTempoLayer}
        showOpenAQLayer={showOpenAQLayer}
        showPandoraLayer={showPandoraLayer}
      />

      {/* 右側資訊面板（浮在地圖上） */}
      <InfoPanel
        open={!!selection}
        data={selection}
        onClose={handleResetToHome}
        showTempoLayer={showTempoLayer}
        onToggleTempoLayer={setShowTempoLayer}
        showOpenAQLayer={showOpenAQLayer}
        onToggleOpenAQLayer={setShowOpenAQLayer}
        showPandoraLayer={showPandoraLayer}
        onTogglePandoraLayer={setShowPandoraLayer}
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
        AirCast | 68332@Taichung NASA Hackathon 2025
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          ...(isMobile ? {
            // 手機版：右上角
            top: '20px',
            right: '10px'
          } : {
            // 桌面版：右下角
            bottom: '45px',
            right: '10px'
          }),
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          padding: '3px 10px',
          fontSize: '12px',
          color: '#374151',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 5
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#8B5CF6',
              border: '1px solid #FFFFFF',
              flexShrink: 0
            }}
          />
          <span>OpenAQ Stations</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#02236bff',
              border: '1px solid #FFFFFF',
              flexShrink: 0
            }}
          />
          <span>Pandora Stations</span>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginTop: '4px',
          paddingTop: '4px',
          borderTop: '1px solid rgba(55, 65, 81, 0.2)'
        }}>
          <div
            style={{
              width: '16px',
              height: '8px',
              background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
              border: '1px solid #FFFFFF',
              borderRadius: '2px',
              flexShrink: 0
            }}
          />
          <span>TEMPO NO₂ (Satellite)</span>
        </div>
      </div>
    </div>
  );
}