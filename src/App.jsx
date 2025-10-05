// src/App.jsx
import * as React from 'react';
import MapView from './MapView';
import InfoPanel from './InfoPanel';
import { getTEMPOValue } from './utils/tempoUtils.js';

export default function App() {
  const [selection, setSelection] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 900);
  const [resetToHome, setResetToHome] = React.useState(false);
  const [currentZoom, setCurrentZoom] = React.useState(3.6);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [openaqStations, setOpenaqStations] = React.useState([]);
  const [isLoadingStations, setIsLoadingStations] = React.useState(false);
  const [searchInputFocused, setSearchInputFocused] = React.useState(false);
  const [clickMarker, setClickMarker] = React.useState(null); // 添加點擊標記狀態
  const mapRef = React.useRef(null);
  
  // 圖層顯示控制狀態
  const [showTempoLayer, setShowTempoLayer] = React.useState(true); // 控制 TEMPO NO2 圖層顯示
  const [showOpenAQLayer, setShowOpenAQLayer] = React.useState(true); // 控制 OpenAQ 監測站顯示
  const [showPandoraLayer, setShowPandoraLayer] = React.useState(true); // 控制 Pandora 監測站顯示
  
  // 載入 OpenAQ 站點資料
  React.useEffect(() => {
    console.log('🚀 useEffect for loading stations triggered!');
    
    const loadOpenAQStations = async () => {
      setIsLoadingStations(true);
      console.log('🔄 Starting to load OpenAQ stations...');
      
      try {
        console.log('📡 Fetching /data/openaq-us-stations.geojson...');
        const response = await fetch('/data/openaq-us-stations.geojson');
        
        console.log('📊 Response:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('✅ Response received, parsing JSON...');
        const data = await response.json();
        console.log('📊 Raw data features count:', data.features?.length);
        
        if (!data.features || data.features.length === 0) {
          throw new Error('No features found in the data');
        }
        
        // 從站點名稱中提取城市和州資訊的輔助函數
        const extractLocationInfo = (name) => {
          // 處理 null、undefined 或空字串的情況
          if (!name || typeof name !== 'string') {
            return {
              city: 'Unknown',
              state: 'US'
            };
          }
          
          // 常見的城市模式：如 "Houston Deer Park C3", "Los Angeles Downtown"
          const parts = name.split(' ');
          if (parts.length >= 2) {
            // 如果名稱包含州的縮寫（如最後兩個字元為大寫字母）
            const lastPart = parts[parts.length - 1];
            if (lastPart.length === 2 && /^[A-Z]{2}$/.test(lastPart)) {
              return {
                city: parts.slice(0, -1).join(' '),
                state: lastPart
              };
            }
            // 否則假設前兩個詞是城市名
            return {
              city: parts.slice(0, 2).join(' '),
              state: 'US'
            };
          }
          return {
            city: name,
            state: 'US'
          };
        };
        
        // 提取站點資訊
        const stations = data.features
          .filter(feature => {
            // 過濾掉沒有必要資料的站點
            return feature.properties && 
                   feature.properties.id && 
                   feature.geometry && 
                   feature.geometry.coordinates;
          })
          .map(feature => {
            const locationInfo = extractLocationInfo(feature.properties.name);
            return {
              id: feature.properties.id,
              name: feature.properties.name || 'Unknown Station',
              city: locationInfo.city,
              state: locationInfo.state,
              country: feature.properties.country || 'United States',
              coordinates: feature.geometry.coordinates, // [lng, lat]
              provider: feature.properties.provider || 'Unknown',
              timezone: feature.properties.timezone || '',
              owner: feature.properties.owner || '',
              countryCode: feature.properties.country_code || '',
              sensors: feature.properties.sensors || []
            };
          });
        
        console.log('🎯 Processed stations:', stations.length);
        setOpenaqStations(stations);
        console.log(`📊 Loaded ${stations.length} OpenAQ stations successfully!`);
        console.log('Sample stations:', stations.slice(0, 3));
      } catch (error) {
        console.error('❌ Failed to load OpenAQ stations:', error);
        console.error('Error details:', error.message, error.stack);
      } finally {
        setIsLoadingStations(false);
        console.log('🏁 Loading process completed, isLoadingStations set to false');
      }
    };

    loadOpenAQStations();
  }, []);

  // 搜尋邏輯
  const searchStations = React.useCallback((query) => {
    if (!query.trim() || openaqStations.length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    
    // 輔助函數：處理空白和底線的匹配
    const normalizeForSearch = (text) => {
      if (!text || typeof text !== 'string') return '';
      return text.toLowerCase()
        .replace(/[_]/g, ' ')  // 將底線轉為空白
        .replace(/\s+/g, ' ')  // 將多個空白合併為一個
        .trim();
    };
    
    // 輔助函數：雙向匹配（搜尋詞中的空白也會匹配底線）
    const matchesText = (text, searchTerm) => {
      if (!text) return false;
      const normalizedText = normalizeForSearch(text);
      const normalizedSearch = normalizeForSearch(searchTerm);
      
      // 直接匹配
      if (normalizedText.includes(normalizedSearch)) return true;
      
      // 反向匹配：搜尋詞的空白匹配文字中的底線
      const searchWithUnderscore = searchTerm.replace(/\s+/g, '_');
      if (text.toLowerCase().includes(searchWithUnderscore)) return true;
      
      return false;
    };
    
    const results = openaqStations.filter(station => {
      // 搜尋站點名稱
      const nameMatch = matchesText(station.name, searchTerm);
      
      // 搜尋城市
      const cityMatch = matchesText(station.city, searchTerm);
      
      // 搜尋州
      const stateMatch = matchesText(station.state, searchTerm);
      
      // 搜尋提供商
      const providerMatch = matchesText(station.provider, searchTerm);
      
      // 搜尋時區 (例如: "America/Chicago" 可以用 "chicago", "america chicago" 等搜尋)
      const timezoneMatch = matchesText(station.timezone, searchTerm);
      
      // 搜尋國家
      const countryMatch = matchesText(station.country, searchTerm);
      
      // 搜尋擁有者
      const ownerMatch = matchesText(station.owner, searchTerm);
      
      // 搜尋國家代碼
      const countryCodeMatch = matchesText(station.countryCode, searchTerm);
      
      // 從時區中提取城市名稱進行搜尋 (例如: "America/New_York" -> "New York")
      let timezoneCityMatch = false;
      if (station.timezone && station.timezone.includes('/')) {
        const timezoneCity = station.timezone.split('/').pop(); // 取最後一部分
        timezoneCityMatch = matchesText(timezoneCity, searchTerm);
      }
      
      return nameMatch || cityMatch || stateMatch || providerMatch || 
             timezoneMatch || countryMatch || ownerMatch || countryCodeMatch || 
             timezoneCityMatch;
    });

    // 排序結果：完全匹配 > 開頭匹配 > 其他匹配
    return results.sort((a, b) => {
      const aNameLower = normalizeForSearch(a.name);
      const bNameLower = normalizeForSearch(b.name);
      const searchNormalized = normalizeForSearch(searchTerm);
      
      // 完全匹配站點名稱
      if (aNameLower === searchNormalized) return -1;
      if (bNameLower === searchNormalized) return 1;
      
      // 站點名稱開頭匹配
      if (aNameLower.startsWith(searchNormalized) && !bNameLower.startsWith(searchNormalized)) return -1;
      if (bNameLower.startsWith(searchNormalized) && !aNameLower.startsWith(searchNormalized)) return 1;
      
      // 城市名稱完全匹配
      const aCityLower = normalizeForSearch(a.city);
      const bCityLower = normalizeForSearch(b.city);
      if (aCityLower === searchNormalized) return -1;
      if (bCityLower === searchNormalized) return 1;
      
      // 按名稱字母順序
      return aNameLower.localeCompare(bNameLower);
    }).slice(0, 15); // 增加到15個結果以支援滾動
  }, [openaqStations]);

  // 搜尋輸入變化處理
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const suggestions = searchStations(searchQuery);
      setSearchSuggestions(suggestions);
      setShowSuggestions(true); // 有搜尋內容時就顯示建議
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, searchStations]);

  // 處理點擊外部關閉建議
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!searchInputFocused && !event.target.closest('[data-search-container]')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchInputFocused]);

  // 處理搜尋結果選擇
  const handleStationSelect = React.useCallback((station) => {
    // 設置點擊標記和選中的站點
    const [lng, lat] = station.coordinates;
    
    // 設置紅色標記和藍色圈圈
    setClickMarker({ lng, lat });
    
    // 先設置基本資料和載入狀態
    const baseData = {
      id: station.id,
      name: station.name,
      stationName: station.name, // InfoPanel 期望的格式
      city: station.city,
      state: station.state,
      country: station.country,
      provider: station.provider,
      timezone: station.timezone,
      owner: station.owner,
      countryCode: station.countryCode,
      sensors: station.sensors,
      coordinates: station.coordinates,
      // InfoPanel 期望的格式
      lat: lat,
      lng: lng,
      isStation: true,
      stationType: 'OpenAQ',
      type: 'openaq',
      stateName: 'Air Quality Station',
      tempoData: null,
      loadingTempoData: true // 觸發 TEMPO 資料載入
    };

    setSelection(baseData);

    // 同時載入 TEMPO 資料
    getTEMPOValue(lng, lat).then(tempoValue => {
      setSelection(prevSelection => ({
        ...prevSelection,
        tempoData: tempoValue,
        loadingTempoData: false
      }));
    }).catch(error => {
      console.error('Error getting TEMPO data for search station:', error);
      setSelection(prevSelection => ({
        ...prevSelection,
        tempoData: null,
        loadingTempoData: false
      }));
    });

    // 跳轉地圖視角到該站點
    if (mapRef.current && station.coordinates) {
      const [lng, lat] = station.coordinates;
      
      try {
        // 使用 flyTo 而不是 easeTo 來獲得更平滑的動畫效果
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: Math.max(10, currentZoom), // 至少放大到 zoom level 10
          duration: 3500, // 增加到3.5秒動畫，更慢更優雅
          essential: true // 確保動畫不會被中斷
        });
      } catch (error) {
        console.error('❌ Map flyTo failed:', error);
      }
    }

    // 清除搜尋相關狀態
    setSearchQuery('');
    setShowSuggestions(false);
    setSearchInputFocused(false);
  }, [currentZoom]);
  
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
    setClickMarker(null); // 清除點擊標記
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
        
        /* 搜尋建議滾動條樣式 */
        .search-suggestions::-webkit-scrollbar {
          width: 6px;
        }
        
        .search-suggestions::-webkit-scrollbar-track {
          background: #f9fafb;
          border-radius: 3px;
        }
        
        .search-suggestions::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 3px;
        }
        
        .search-suggestions::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
        
        /* 強制移除搜尋欄的所有文字陰影 */
        input[type="text"], input[type="search"], input {
          text-shadow: none !important;
          -webkit-text-shadow: none !important;
          -moz-text-shadow: none !important;
          box-shadow: none !important;
          -webkit-box-shadow: none !important;
          -moz-box-shadow: none !important;
          border: none !important;
          outline: none !important;
        }
        
        input::placeholder {
          text-shadow: none !important;
          -webkit-text-shadow: none !important;
          -moz-text-shadow: none !important;
        }
        
        /* 針對搜尋容器內的輸入框 */
        [data-search-container] input {
          text-shadow: none !important;
          -webkit-text-shadow: none !important;
          -moz-text-shadow: none !important;
          box-shadow: none !important;
          -webkit-box-shadow: none !important;
          -moz-box-shadow: none !important;
          border: none !important;
          outline: none !important;
          background: transparent !important;
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
        clickMarker={clickMarker}
        setClickMarker={setClickMarker}
      />

      {/* 搜尋欄 */}
      <div
        data-search-container
        style={{
          position: 'absolute',
          top: isMobile ? '15px' : '20px',
          left: isMobile ? '30%' :'50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: isMobile ? 'calc(100% - 180px)' : '420px',
          maxWidth: isMobile ? 'none' : '420px',
          padding: isMobile ? '0 15px' : '0'
        }}
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(12px)',
              borderRadius: isMobile ? '20px' : '25px',
              padding: isMobile ? '10px 16px' : '12px 20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)', // 恢復外框陰影
              border: '1px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              transition: 'all 0.2s ease-in-out',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)'; // 恢復懸停陰影
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'; // 恢復離開陰影
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            <svg
              width={isMobile ? "16" : "18"}
              height={isMobile ? "16" : "18"}
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
              placeholder={isMobile ? "Search locations..." : "Search locations, cities, or stations..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchInputFocused(true)}
              onBlur={() => {
                // 延遲隱藏建議，讓用戶有時間點擊建議
                setTimeout(() => {
                  setSearchInputFocused(false);
                  if (!searchQuery.trim()) {
                    setShowSuggestions(false);
                  }
                }, 200);
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: isMobile ? '16px' : '14px', // 16px 防止手機縮放
                color: '#374151',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                minWidth: 0, // 確保在小螢幕上能縮小
                textShadow: 'none !important', // 強制移除文字陰影
                WebkitTextShadow: 'none !important', // Safari 專用
                MozTextShadow: 'none !important', // Firefox 專用
                WebkitAppearance: 'none', // 移除 WebKit 預設外觀
                appearance: 'none' // 移除預設外觀
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // 如果有建議結果，選擇第一個
                  if (searchSuggestions.length > 0) {
                    handleStationSelect(searchSuggestions[0]);
                  }
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSuggestions(false);
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: isMobile ? '6px' : '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease',
                  minWidth: isMobile ? '28px' : '24px',
                  minHeight: isMobile ? '28px' : '24px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <svg
                  width={isMobile ? "16" : "14"}
                  height={isMobile ? "16" : "14"}
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

          {/* 搜尋建議下拉選單 */}
          {(searchQuery.trim() && (searchSuggestions.length > 0 || isLoadingStations)) && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(12px)',
                borderRadius: isMobile ? '12px' : '16px',
                marginTop: '8px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)', // 恢復下拉清單外框陰影
                border: '1px solid rgba(255, 255, 255, 0.4)',
                overflow: 'hidden',
                zIndex: 1000,
                // 動態設定高度：如果結果數量 <= 5 就自適應，否則限制高度
                maxHeight: searchSuggestions.length <= 5 ? 'none' : (isMobile ? '250px' : '300px')
              }}
            >
              <div 
                className="search-suggestions"
                style={{
                  overflowY: searchSuggestions.length > 5 ? 'auto' : 'visible', // 只有超過5個才顯示滾動
                  maxHeight: searchSuggestions.length > 5 ? (isMobile ? '240px' : '280px') : 'none',
                  scrollbarWidth: 'thin', // Firefox 
                  scrollbarColor: '#e5e7eb #f9fafb' // Firefox
                }}>
                {isLoadingStations ? (
                  <div style={{
                    padding: isMobile ? '16px' : '12px 20px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: isMobile ? '14px' : '13px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    Loading stations...
                  </div>
                ) : searchSuggestions.length > 0 ? (
                  searchSuggestions.map((station, index) => (
                    <button
                      key={station.id}
                      onClick={() => handleStationSelect(station)}
                      style={{
                        width: '100%',
                        padding: isMobile ? '12px 16px' : '10px 20px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: isMobile ? '14px' : '13px',
                        color: '#374151',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        transition: 'background-color 0.15s ease',
                        borderBottom: index < searchSuggestions.length - 1 ? '1px solid rgba(156, 163, 175, 0.1)' : 'none',
                        display: 'block',
                        boxShadow: 'none', // 確保沒有陰影
                        WebkitBoxShadow: 'none', // Safari
                        MozBoxShadow: 'none' // Firefox
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ 
                        fontWeight: '500', 
                        marginBottom: '2px',
                        textShadow: 'none',
                        WebkitTextShadow: 'none',
                        MozTextShadow: 'none'
                      }}>
                        {station.name}
                      </div>
                      <div style={{ 
                        fontSize: isMobile ? '12px' : '11px', 
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textShadow: 'none',
                        WebkitTextShadow: 'none',
                        MozTextShadow: 'none'
                      }}>
                        <span>{station.city}, {station.state}</span>
                        <span style={{ color: '#9ca3af' }}>•</span>
                        <span>{station.provider}</span>
                        {station.timezone && (
                          <>
                            <span style={{ color: '#9ca3af' }}>•</span>
                            <span style={{ fontSize: isMobile ? '11px' : '10px', color: '#9ca3af' }}>
                              {station.timezone.split('/').pop()?.replace(/_/g, ' ')}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  ))
                ) : searchQuery.trim() && (
                  <div style={{
                    padding: isMobile ? '16px' : '12px 20px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: isMobile ? '14px' : '13px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    No stations found for "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
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