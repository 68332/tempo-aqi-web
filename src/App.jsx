// src/App.jsx
import * as React from 'react';
import MapView from './MapView';
import InfoPanel from './InfoPanel';

export default function App() {
  const [selection, setSelection] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 900);
  const [resetToHome, setResetToHome] = React.useState(false);
  const [currentZoom, setCurrentZoom] = React.useState(3.6);
  const [searchQuery, setSearchQuery] = React.useState('');
  const mapRef = React.useRef(null);
  
  // 圖層顯示控制狀態
  const [showTempoLayer, setShowTempoLayer] = React.useState(true); // 控制 TEMPO NO2 圖層顯示
  const [showOpenAQLayer, setShowOpenAQLayer] = React.useState(true); // 控制 OpenAQ 監測站顯示
  const [showPandoraLayer, setShowPandoraLayer] = React.useState(true); // 控制 Pandora 監測站顯示
  
  // 縮放控制函數
  const handleZoomChange = (newZoom) => {
    setCurrentZoom(newZoom);
    if (mapRef.current) {
      mapRef.current.setZoom(newZoom);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(15, currentZoom + 0.5);
    setCurrentZoom(newZoom);
    if (mapRef.current) {
      // 按鈕操作使用緩衝動畫
      mapRef.current.easeTo({
        zoom: newZoom,
        duration: 300
      });
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(3, currentZoom - 0.5);
    setCurrentZoom(newZoom);
    if (mapRef.current) {
      // 按鈕操作使用緩衝動畫
      mapRef.current.easeTo({
        zoom: newZoom,
        duration: 300
      });
    }
  };

  const handleSliderChange = (event) => {
    const newZoom = parseFloat(event.target.value);
    // 拉條操作立即響應，無緩衝
    handleZoomChange(newZoom);
  };

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
      {/* Custom CSS for slider */}
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }
        
        input[type="range"]::-webkit-slider-track {
          width: 100%;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          border: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 6px;
          height: 16px;
          background: #6b7280;
          border-radius: 3px;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          background: #4b5563;
        }
        
        input[type="range"]::-moz-range-track {
          width: 100%;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          border: none;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 6px;
          height: 16px;
          background: #6b7280;
          border-radius: 3px;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          -moz-appearance: none;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          background: #4b5563;
        }
      `}</style>
      {/* 地圖：把點擊結果丟回來 */}
      <MapView 
        onSelect={setSelection} 
        resetToHome={resetToHome} 
        showTempoLayer={showTempoLayer}
        showOpenAQLayer={showOpenAQLayer}
        showPandoraLayer={showPandoraLayer}
        currentZoom={currentZoom}
        onZoomChange={setCurrentZoom}
        mapRef={mapRef}
      />

      {/* 搜尋欄 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: isMobile ? '90%' : '400px',
          maxWidth: '400px'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: '25px',
            padding: '8px 20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search locations, cities, or stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              color: '#374151',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                // TODO: 實作搜尋功能
                console.log('Searching for:', searchQuery);
              }
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

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

      {/* Zoom Slider */}
      <div
        style={{
          position: 'absolute',
          ...(isMobile ? {
            // 手機版：右上角，緊貼 legend 下面
            top: '95px',
            right: '12px'
          } : {
            // 桌面版：右下角，緊貼 legend 上面
            bottom: '120px',
            right: '10px'
          }),
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '10px', // 與 legend 相同的圓角
          padding: '3px 18px', // 與 legend 相同的內邊距
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 5,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '6px',
          width: isMobile ? '170px' : '170px' // 縮短整體長度
        }}
      >
        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          disabled={currentZoom <= 3}
          style={{
            width: '20px',
            height: '20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '4px',
            cursor: currentZoom <= 3 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: currentZoom <= 3 ? '#9ca3af' : '#4a5568',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (currentZoom > 3) {
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentZoom > 3) {
              e.target.style.backgroundColor = 'transparent';
            }
          }}
        >
          −
        </button>

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '12px',
          backgroundColor: '#e2e8f0'
        }} />

        {/* Slider */}
        <input
          type="range"
          min={3}
          max={15}
          step={0.1}
          value={currentZoom}
          onChange={handleSliderChange}
          style={{
            width: '80px', // 固定較短的滑動條寬度
            height: '4px',
            background: '#e2e8f0',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none'
          }}
        />

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '12px',
          backgroundColor: '#e2e8f0'
        }} />

        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          disabled={currentZoom >= 15}
          style={{
            width: '20px',
            height: '20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '4px',
            cursor: currentZoom >= 15 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            color: currentZoom >= 15 ? '#9ca3af' : '#4a5568',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (currentZoom < 15) {
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentZoom < 15) {
              e.target.style.backgroundColor = 'transparent';
            }
          }}
        >
          +
        </button>
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