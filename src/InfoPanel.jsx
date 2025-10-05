// src/InfoPanel.jsx
import * as React from 'react';
import {
  Paper,
  Typography,
  Box,
  Divider,
  Grid,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';

export default function InfoPanel({ 
  open, 
  data, 
  onClose, 
  showTempoLayer, 
  onToggleTempoLayer, 
  showOpenAQLayer, 
  onToggleOpenAQLayer, 
  showPandoraLayer, 
  onTogglePandoraLayer,
  featuredStationsData,
  isLoadingFeaturedStations,
  onFlyToStation
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 狀態管理
  const [sensorData, setSensorData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [nearbyDataLoading, setNearbyDataLoading] = React.useState(false);
  const [titleKey, setTitleKey] = React.useState(0);
  const [aqiData, setAqiData] = React.useState(null);
  const [tempoObservationTime, setTempoObservationTime] = React.useState(null);
  const [mlPrediction, setMlPrediction] = React.useState(null);
  const [mlPredictionLoading, setMlPredictionLoading] = React.useState(false);
  const [prevStationId, setPrevStationId] = React.useState(null);
  
  // 獲取 TEMPO 數據的觀測時間（與 MapView 中的邏輯一致）
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

  // 在組件載入時獲取 TEMPO 觀測時間
  React.useEffect(() => {
    getTEMPOObservationTime().then(time => {
      setTempoObservationTime(time);
    });
  }, []);

  // 當 data 改變時觸發標題動畫
  React.useEffect(() => {
    setTitleKey(prev => prev + 1);
  }, [!!data]);

  // 當位置發生變化或開始載入新數據時立即重置 AQI 數據，避免顯示上一個位置的 AQI
  React.useEffect(() => {
    if (data) {
      console.log('Position changed or loading new data, resetting AQI and sensor data');
      setAqiData(null);
      setSensorData([]); // 也重置 sensor 數據
      setLoading(false); // 重置載入狀態
    }
  }, [data?.lng, data?.lat, data?.loadingNearbyData, data?.loadingTempoData]);

  // 將 TEMPO NO2 柱濃度轉換為地表濃度 (ppb)
  const convertTEMPOColumnToPPB = (columnDensity) => {
    // columnDensity: molecules/cm²
    // 返回: ppb (parts per billion by volume)
    
    if (!columnDensity || columnDensity <= 0) return null;
    
    // 轉換常數和假設
    const AVOGADRO = 6.022e23; // molecules/mol
    const MOLAR_VOLUME_STP = 22.4; // L/mol at STP
    const PRESSURE_SURFACE = 1013.25; // hPa (標準大氣壓)
    const TEMPERATURE_SURFACE = 288.15; // K (15°C)
    
    // 假設對流層混合層高度 (典型值 1-2 km)
    const MIXING_HEIGHT = 1.5e5; // cm (1.5 km = 150,000 cm)
    
    // 形狀因子：考慮 NO2 在對流層中的垂直分布
    // 大部分 NO2 集中在邊界層，使用經驗值 0.6-0.8
    const SHAPE_FACTOR = 0.7;
    
    try {
      // 步驟 1: 假設柱濃度主要來自混合層
      const volumeDensity = (columnDensity * SHAPE_FACTOR) / MIXING_HEIGHT; // molecules/cm³
      
      // 步驟 2: 轉換為分子濃度 (mol/cm³)
      const molarConcentration = volumeDensity / AVOGADRO; // mol/cm³
      
      // 步驟 3: 轉換為體積混合比 (ppb)
      // 使用理想氣體定律: PV = nRT
      // 空氣密度在標準條件下約為 2.46e19 molecules/cm³
      const airDensity = (PRESSURE_SURFACE * 100) / (1.38e-16 * TEMPERATURE_SURFACE); // molecules/cm³
      const ppb = (volumeDensity / airDensity) * 1e9; // ppb
      
      // 信心度評估
      let confidence = 0.7; // 基礎信心度
      let uncertainty = null;
      
      if (ppb <= 0) {
        confidence = 0.1;
        uncertainty = "Negative values indicate data quality issues";
      } else if (ppb > 200) {
        confidence = 0.4;
        uncertainty = "Very high values may indicate pollution events or data errors";
      } else if (ppb > 100) {
        confidence = 0.6;
        uncertainty = "High values should be validated with ground measurements";
      }

      return {
        ppb: ppb,
        columnDensity: columnDensity,
        mixingHeight: MIXING_HEIGHT / 1e5, // km
        shapeFactor: SHAPE_FACTOR,
        confidence: confidence,
        uncertainty: uncertainty
      };
    } catch (error) {
      console.error('TEMPO conversion error:', error);
      return null;
    }
  };

  // AQI 計算函數
  const calculateAQI = (pollutants) => {
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
      console.log(`Calculating AQI for ${pollutant}, concentration: ${concentration}, breakpoints:`, breakpoints);
      
      if (!breakpoints || concentration === null || concentration === undefined) {
        console.log(`No breakpoints or invalid concentration for ${pollutant}`);
        return null;
      }

      for (const bp of breakpoints) {
        if (concentration >= bp.lo && concentration <= bp.hi) {
          const aqi = Math.round(
            ((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (concentration - bp.lo) + bp.aqiLo
          );
          console.log(`AQI calculated for ${pollutant}: ${aqi}`);
          return aqi;
        }
      }
      console.log(`No matching breakpoint found for ${pollutant} with concentration ${concentration}`);
      return null;
    };

    let maxAqi = 0;
    let dominantPollutant = '';
    const individualAqis = {};

    console.log('Pollutants data for AQI calculation:', pollutants);

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

    console.log('Final AQI calculation result:', { maxAqi, dominantPollutant, individualAqis });
    return maxAqi > 0 ? { aqi: maxAqi, dominantPollutant, individualAqis } : null;
  };

  // AQI 顏色和類別
  const getAQIInfo = (aqi) => {
    if (aqi <= 50) return { level: 'Good', color: '#00E400', textColor: '#000000' };
    if (aqi <= 100) return { level: 'Moderate', color: '#FFFF00', textColor: '#000000' };
    if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#FF7E00', textColor: '#000000' };
    if (aqi <= 200) return { level: 'Unhealthy', color: '#FF0000', textColor: '#FFFFFF' };
    if (aqi <= 300) return { level: 'Very Unhealthy', color: '#8F3F97', textColor: '#FFFFFF' };
    return { level: 'Hazardous', color: '#7E0023', textColor: '#FFFFFF' };
  };

  // 當 data 改變且有 sensors 時，獲取 sensor 資料
  React.useEffect(() => {
    if (data) {
      console.log('InfoPanel data changed:', { id: data.id, type: data.type }); // Debug
      
      // 清空之前的 ML prediction (但只在站點真正改變時)
      if (!mlPredictionLoading || prevStationId !== data.id) {
        setMlPrediction(null);
        setMlPredictionLoading(false);
      }
      
      // if data is from openaq
      if (data.type === 'openaq') {
        if (data && data.sensors && data.sensors.length > 0) {
          console.log('Fetching data for sensors:', data.sensors); // Debug
          fetchSensorData(data.sensors);
          
          // 只有當不是重複請求時才獲取機器學習預測
          if (!mlPredictionLoading && prevStationId !== data.id) {
            console.log('OpenAQ station detected, fetching ML prediction for station:', data.id); // Debug
            fetchMlPrediction(data.id);
          }
        } else {
          setSensorData([]);
        }
        // if data is from pandora
      } else if (data.type === 'pandora') {
        fetchPandoraData(data);
        
        // 只有當不是重複請求時才獲取機器學習預測
        if (!mlPredictionLoading && prevStationId !== data.id) {
          console.log('Pandora station detected, fetching ML prediction for station:', data.id); // Debug
          fetchMlPrediction(data.id);
        }
      }
      
      // 更新前一個站點 ID
      setPrevStationId(data.id);
    }
  }, [data]);

  // 將不同單位的 NO2 轉換為 ppb (AQI 計算標準單位)
  const convertNO2ToPPB = (value, unit) => {
    if (!value || !unit) return value;
    
    const unitLower = unit.toLowerCase();
    
    // 如果已經是 ppb，直接返回
    if (unitLower.includes('ppb')) {
      return value;
    }
    
    // 如果是 μg/m³，轉換為 ppb
    // NO2 分子量 = 46.0055 g/mol
    // 在標準條件下 (20°C, 1 atm): 1 ppb = 1.88 μg/m³
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 1.88; // μg/m³ to ppb
    }
    
    // 如果是 ppm，轉換為 ppb
    if (unitLower.includes('ppm')) {
      return value * 1000; // ppm to ppb
    }
    
    // 預設假設是 ppb
    return value;
  };

  // 將不同單位的 O3 轉換為 ppb (AQI 計算標準單位)
  const convertO3ToPPM = (value, unit) => {
    if (!value || !unit) return value;
    
    const unitLower = unit.toLowerCase();
    
    // 如果已經是 ppm，直接返回
    if (unitLower.includes('ppm') && !unitLower.includes('ppb')) {
      return value;
    }
    
    // 如果是 μg/m³，轉換為 ppm
    // O3 分子量 = 47.998 g/mol
    // 在標準條件下 (20°C, 1 atm): 1 ppm = 1960 μg/m³
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 1960; // μg/m³ to ppm
    }
    
    // 如果是 ppb，轉換為 ppm
    if (unitLower.includes('ppb')) {
      return value / 1000; // ppb to ppm
    }
    
    // 預設假設是 ppb
    return value;
  };

  // 將不同單位的 SO2 轉換為 ppb (AQI 計算標準單位)
  const convertSO2ToPPB = (value, unit) => {
    if (!value || !unit) return value;
    
    const unitLower = unit.toLowerCase();
    
    // 如果已經是 ppb，直接返回
    if (unitLower.includes('ppb')) {
      return value;
    }
    
    // 如果是 μg/m³，轉換為 ppb
    // SO2 分子量 = 64.066 g/mol
    // 在標準條件下 (20°C, 1 atm): 1 ppb = 2.62 μg/m³
    if (unitLower.includes('μg/m³') || unitLower.includes('ug/m3')) {
      return value / 2.62; // μg/m³ to ppb
    }
    
    // 如果是 ppm，轉換為 ppb
    if (unitLower.includes('ppm')) {
      return value * 1000; // ppm to ppb
    }
    
    // 預設假設是 ppb
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

  // 計算 AQI 當所有資料都載入完成時
  React.useEffect(() => {
    console.log('AQI calculation useEffect triggered:', {
      hasNearbyData: !!data?.nearbyStationsData?.pollutantData,
      sensorDataLength: sensorData.length,
      hasTempoData: !!data?.tempoData,
      tempoValue: data?.tempoData?.value,
      loadingNearbyData: data?.loadingNearbyData,
      loadingTempoData: data?.loadingTempoData,
      loading: loading
    });

    // 檢查是否還有資料在載入中
    const isStillLoading = data?.loadingNearbyData || data?.loadingTempoData || loading;
    
    if (isStillLoading) {
      console.log('Still loading data, waiting for all data to complete...');
      return; // 如果還有資料在載入，不計算 AQI
    }

    // 確保所有資料都載入完成後才計算 AQI
    console.log('All data loaded, calculating AQI...');

    if (data?.nearbyStationsData?.pollutantData) {
      // 複製附近站點的污染物數據 (地面站數據)
      const pollutantData = { ...data.nearbyStationsData.pollutantData };
      console.log('Original nearby stations pollutant data (ground only):', pollutantData);
      
      // 如果地面站沒有 NO2 數據，但有 TEMPO 數據，則補充 TEMPO NO2
      if (data?.tempoData && (!pollutantData.no2 || pollutantData.no2.values.length === 0)) {
        const tempoConversion = convertTEMPOColumnToPPB(data.tempoData.value);
        console.log('Adding TEMPO NO2 to supplement ground stations data:', tempoConversion);
        
        if (tempoConversion && tempoConversion.ppb > 0) {
          pollutantData.no2 = {
            max: tempoConversion.ppb,
            values: [tempoConversion.ppb],
            unit: 'ppb',
            source: 'satellite'
          };
          console.log('Updated pollutant data with TEMPO NO2 supplement:', pollutantData);
        }
      }
      
      const aqiResult = calculateAQI(pollutantData);
      console.log('Calculated AQI from nearby stations (with TEMPO supplement if needed):', aqiResult);
      setAqiData(aqiResult);
    } else if (sensorData.length > 0) {
      // 對於單一監測站，從 sensor 數據計算 AQI (只用地面站數據)
      const pollutantData = {};
      sensorData.forEach(item => {
        if (item.data?.latest?.value !== null && item.data?.latest?.value !== undefined) {
          const paramName = item.sensor.parameter_name?.toLowerCase();
          if (['pm25', 'pm10', 'o3', 'co', 'so2', 'no2'].includes(paramName)) {
            let value = item.data.latest.value;
            let unit = item.sensor.parameter_units;
            
            // 對於 NO2、SO2，確保轉換為 ppb 用於 AQI 計算
            // 對於 O3，轉換為 ppm 用於 AQI 計算
            if (paramName === 'no2') {
              value = convertNO2ToPPB(value, unit);
              unit = 'ppb';
            } else if (paramName === 'o3') {
              value = convertO3ToPPM(value, unit);
              unit = 'ppm';
            } else if (paramName === 'so2') {
              value = convertSO2ToPPB(value, unit);
              unit = 'ppb';
            }
            
            pollutantData[paramName] = {
              max: value,
              values: [value],
              unit: unit,
              source: 'ground'
            };
          }
        }
      });
      
      // 如果地面站沒有 NO2 數據，但有 TEMPO 數據，則補充 TEMPO NO2
      if (data?.tempoData && !pollutantData.no2) {
        const tempoConversion = convertTEMPOColumnToPPB(data.tempoData.value);
        console.log('Adding TEMPO NO2 to supplement single station data:', tempoConversion);
        
        if (tempoConversion && tempoConversion.ppb > 0) {
          pollutantData.no2 = {
            max: tempoConversion.ppb,
            values: [tempoConversion.ppb],
            unit: 'ppb',
            source: 'satellite'
          };
          console.log('Updated single station data with TEMPO NO2 supplement:', pollutantData);
        }
      }
      
      const aqiResult = calculateAQI(pollutantData);
      console.log('Calculated AQI from sensors (with TEMPO supplement if needed):', aqiResult);
      setAqiData(aqiResult);
    } else if (data?.tempoData) {
      // 只有 TEMPO 數據時，單獨計算基於衛星 NO2 的 AQI
      console.log('Processing TEMPO-only data:', data.tempoData);
      const tempoConversion = convertTEMPOColumnToPPB(data.tempoData.value);
      console.log('TEMPO conversion result:', tempoConversion);
      
      if (tempoConversion && tempoConversion.ppb > 0) {
        const pollutantData = {
          no2: {
            max: tempoConversion.ppb,
            values: [tempoConversion.ppb],
            source: 'satellite'
          }
        };
        const aqiResult = calculateAQI(pollutantData);
        console.log('Calculated AQI from TEMPO only:', aqiResult);
        setAqiData(aqiResult);
      } else {
        console.log('TEMPO conversion failed or invalid ppb value');
        setAqiData(null);
      }
    } else {
      console.log('No data available for AQI calculation');
      setAqiData(null);
    }
  }, [data?.nearbyStationsData, sensorData, data?.tempoData, data?.loadingNearbyData, data?.loadingTempoData, loading]);

  // 獲取機器學習預測數據
  const fetchMlPrediction = async (stationId) => {
    console.log('fetchMlPrediction called with stationId:', stationId, 'type:', typeof stationId);
    
    setMlPredictionLoading(true);
    
    console.log('Fetching ML prediction for station:', stationId);
    try {
      const response = await fetch(`https://aircast-cors-proxy.aircast68332.workers.dev/api/ml/predict_aqi?station_id=${stationId}`);
      if (!response.ok) {
        // 如果是 404 或其他錯誤，說明該站點不支援 ML 預測，靜默處理
        console.log(`ML prediction not available for station ${stationId} (status: ${response.status})`);
        setMlPrediction(null);
        return;
      }
      const data = await response.json();
      console.log('ML prediction response:', data);
      setMlPrediction(data);
    } catch (error) {
      console.log('ML prediction not available for station:', stationId, 'Error:', error.message);
      setMlPrediction(null);
    } finally {
      setMlPredictionLoading(false);
    }
  };

  // 獲取 sensor 資料的函數
  const fetchSensorData = async (sensors) => {
    setLoading(true);

    // 直接在這裡設定你的 OpenAQ API key
    const API_KEY = 'f842213920405091f23318ca1a7880636ac843b7cb81f8e3985c41b17deb19f2'; // 請替換為你的實際 API key

    if (!API_KEY || API_KEY === 'your-api-key-here') {
      console.error('請設定 OpenAQ API key');
      setSensorData([]);
      setLoading(false);
      return;
    }

    try {
      // 定義目標污染物
      const targetPollutants = ['pm25', 'pm10', 'o3', 'co', 'so2', 'no2'];

      // 確保 sensors 是陣列並過濾只要目標污染物
      console.log('Sensors type:', typeof sensors, 'Is array:', Array.isArray(sensors));

      let sensorsArray;
      if (Array.isArray(sensors)) {
        sensorsArray = sensors;
      } else if (typeof sensors === 'string') {
        // 如果是字串，嘗試解析 JSON
        try {
          sensorsArray = JSON.parse(sensors);
        } catch (parseError) {
          console.error('Failed to parse sensors JSON:', parseError);
          sensorsArray = [];
        }
      } else {
        sensorsArray = [];
      }

      // 過濾只保留目標污染物的sensors
      const filteredSensors = sensorsArray.filter(sensor => {
        const paramName = sensor.parameter_name?.toLowerCase();
        return targetPollutants.includes(paramName);
      });

      console.log('Parsed sensorsArray:', sensorsArray.length);
      console.log('Filtered sensors for target pollutants:', filteredSensors.length);
      const limitedSensors = filteredSensors.slice(0, 10);
      console.log(`Processing ${limitedSensors.length} out of ${filteredSensors.length} filtered sensors`);

      if (limitedSensors.length === 0) {
        console.log('No sensors to process');
        setSensorData([]);
        setLoading(false);
        return;
      }

      const promises = limitedSensors.map(async (sensor) => {
        try {
          // 使用 Cloudflare Worker 代理所有 API 請求
          const apiUrl = `https://aircast-cors-proxy.aircast68332.workers.dev/api/openaq/v3/sensors/${sensor.id}`;
          
          // 使用 Cloudflare Worker 來避免 CORS 問題
          const response = await fetch(apiUrl, {
            headers: {
              'x-api-key': API_KEY  // 改用小寫的 header 名稱
            }
          });
          console.log(`Sensor ${sensor.id} response:`, response.status); // Debug
          if (response.ok) {
            const result = await response.json();
            console.log(`Sensor ${sensor.id} data:`, result); // Debug
            
            // 詳細檢查數值精度
            if (result.results && result.results[0] && result.results[0].latest) {
              const latestValue = result.results[0].latest.value;
              console.log(`Sensor ${sensor.id} raw value type:`, typeof latestValue);
              console.log(`Sensor ${sensor.id} raw value:`, latestValue);
              console.log(`Sensor ${sensor.id} raw value precision:`, latestValue?.toString());
              
              // 檢查是否為科學記號
              if (typeof latestValue === 'number') {
                console.log(`Sensor ${sensor.id} exponential:`, latestValue.toExponential());
                console.log(`Sensor ${sensor.id} fixed(10):`, latestValue.toFixed(10));
              }
            }
            
            return {
              sensor: sensor,
              data: result.results[0],
              error: null
            };
          } else {
            const errorText = await response.text();
            console.error(`Sensor ${sensor.id} error:`, response.status, errorText);
            return {
              sensor: sensor,
              data: null,
              error: `HTTP ${response.status}: ${errorText}`
            };
          }
        } catch (error) {
          return {
            sensor: sensor,
            data: null,
            error: error.message
          };
        }
      });

      const results = await Promise.all(promises);
      console.log('API results:', results); // Debug
      console.log('Setting sensor data, length:', results.length); // Debug
      setSensorData(results);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      setSensorData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Pandora data
  const fetchPandoraData = async (data) => {
    setLoading(true);
    try {
      // 使用 Cloudflare Worker 代理所有 API 請求
      const pandoraApiUrl = `https://aircast-cors-proxy.aircast68332.workers.dev/api/pandora/${data.stationName}/${data.instrument}/L2/${data.instrument}_${data.stationName}_L2_rnvh3p1-8.txt`;
      
      // use Cloudflare Worker to avoid CORS issue
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
          const value = cols[56];
          const isoTimestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(9, 11)}:${timestamp.slice(11, 13)}:${timestamp.slice(13, 15)}Z`;

          setSensorData([{
            sensor: {
              parameter_display_name: 'NO₂',
              parameter_name: 'no2',
              parameter_units: 'mol/m3' // 若知道正確單位請替換
            },
            data: {
              latest: {
                value: value != null ? Number(value) : null,
                datetime: { local: isoTimestamp }
              },
              summary: null,
            },
            error: null
          }]);
        } else {
          setSensorData([]);
          setLoading(false);
        }
        return
      } else {
        setSensorData([]);
        setLoading(false);
        return
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      setSensorData([]);
      setLoading(false);
      return
    } finally {
      setLoading(false);
    }
  }

  // Debug: 監聽 sensorData 變化
  React.useEffect(() => {
    console.log('sensorData changed:', sensorData);
  }, [sensorData]);

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        ...(isMobile ? {
          // 手機版：顯示在底部
          bottom: 45,
          left: 15,
          right: 15,
          height: 300,
          width: 'auto'
        } : {
          // 桌面版：顯示在左側
          top: 20,
          left: 20, // 增加左邊間距
          height: 'calc(100vh - 60px)',
          width: 360
        }),
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 5,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(117, 116, 116, 0.04)',
          },
          transition: 'backgroundColor 0.2s ease-in-out',
        }}
        onClick={() => {
          // 清除選中的資料，回到首頁狀態
          setMlPrediction(null);
          setMlPredictionLoading(false);
          if (onClose) {
            onClose();
          }
        }}
      >
        <Box
          sx={{
            width: 15,
            height: 15,
            borderRadius: '50%',
            backgroundColor: (loading || data?.loadingNearbyData) ? '#9CA3AF' : 
              (aqiData ? getAQIInfo(aqiData.aqi).color : '#22C55E'),
            mr: 1.5,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': {
                opacity: 1,
                transform: 'scale(1)',
              },
              '50%': {
                opacity: 0.5,
                transform: 'scale(1.2)',
              },
              '100%': {
                opacity: 1,
                transform: 'scale(1)',
              },
            },
          }}
        />
        <Typography 
          key={titleKey}
          variant="h6" 
          component="h2" 
          fontWeight="bold"
          sx={{
            animation: 'fadeInText 0.6s ease-in-out',
            '@keyframes fadeInText': {
              '0%': {
                opacity: 0,
                transform: 'translateY(0px)',
              },
              '100%': {
                opacity: 1,
                transform: 'translateY(0)',
              },
            },
          }}
        >
          {!data ? 'Hi, Welcome to AirCast!' : 'AirCast'}
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
        {!data ? (
          <Box>
            {/* 搜尋提示 */}
            <Typography variant="h6" fontWeight="600" sx={{ mb: 2, color: 'primary.main' }}>
              Search or click on map to get real-time air quality
            </Typography>
            
            {/* 重要城市AQI */}
            <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1 }}>
              Major Cities Air Quality
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Real-time AQI from key monitoring stations:
            </Typography>
            
            {isLoadingFeaturedStations ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                {featuredStationsData && featuredStationsData.length > 0 ? (
                  featuredStationsData.map((station, index) => {
                    // 從站點名稱提取城市名稱
                    const getCityName = (stationName) => {
                      const cityMappings = {
                        'McMillan Reservoir': 'Washington DC',
                        'Houston Deer Park C3': 'Houston',
                        'Grand Rapids': 'Grand Rapids',
                        'Denver - CAMP': 'Denver',
                        'Seattle-Beacon Hill': 'Seattle',
                        'Phoenix JLG Supersit': 'Phoenix',
                        'Boston - Roxbury': 'Boston',
                        'Indpls-Washington Pa': 'Indianapolis',
                        'Los Angeles - N. Mai': 'Los Angeles',
                        'Oakland West': 'San Francisco Bay Area'
                      };
                      return cityMappings[stationName] || stationName;
                    };

                    return (
                      <Box
                        key={station.id}
                        sx={{
                          border: '1px solid',
                          borderColor: station.aqiColor || '#e0e0e0',
                          borderRadius: 2,
                          p: 2,
                          mb: 1,
                          cursor: 'pointer',
                          backgroundColor: 'background.paper',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            transform: 'translateY(-1px)',
                            boxShadow: 1
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={() => onFlyToStation && onFlyToStation(station)}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2" fontWeight="600">
                            {getCityName(station.actualName || station.name)}
                          </Typography>
                          {station.aqi !== null ? (
                            <Chip
                              label={`AQI ${station.aqi}`}
                              size="small"
                              sx={{
                                backgroundColor: station.aqiColor,
                                color: station.aqiColor === '#FFFF00' ? '#000000' : '#FFFFFF',
                                fontWeight: 'bold',
                                fontSize: '0.75rem'
                              }}
                            />
                          ) : (
                            <Chip
                              label="Loading..."
                              size="small"
                              sx={{
                                backgroundColor: '#grey.300',
                                color: 'text.secondary',
                                fontSize: '0.75rem'
                              }}
                            />
                          )}
                        </Box>
                        {station.aqi !== null && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {station.aqiLevel} • {station.measurements?.length || 0} sensors
                          </Typography>
                        )}
                      </Box>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Loading major cities data...
                  </Typography>
                )}
              </Box>
            )}
            
            {/* 應用程式簡介 */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              AirCast is a web-based platform that forecasts and visualizes air quality across the United States. By combining satellite observations, ground-based measurements, and atmospheric networks, AirCast provides a unified view of air pollution to support public health and decision-making.
            </Typography>
            
            <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1 }}>
              Data Sources
            </Typography>
            <Box sx={{ mb: 2, pl: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • <strong>NASA TEMPO</strong> - Satellite observations of air pollutants
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, ml: 2, display: 'block' }}>
                Latest update TEMPO NO2 data: {tempoObservationTime ? tempoObservationTime.toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                }) : 'Loading...'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • <strong>OpenAQ</strong> - Ground-based air quality monitoring network
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • <strong>Pandora</strong> - Atmospheric composition measurement stations
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box>
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid size={6}>
                  <Typography variant="caption" color="text.secondary">
                    {data.isStation ? 'Station' : 'State'}
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {data.isStation ? data.stationName : data.stateName}
                  </Typography>
                </Grid>
                <Grid size={3}>
                  <Typography variant="caption" color="text.secondary">
                    Latitude
                  </Typography>
                  <Typography variant="body2">
                    {data.lat && typeof data.lat === 'number' ? data.lat.toFixed(5) : 'N/A'}
                  </Typography>
                </Grid>
                <Grid size={3}>
                  <Typography variant="caption" color="text.secondary">
                    Longitude
                  </Typography>
                  <Typography variant="body2">
                    {data.lng && typeof data.lng === 'number' ? data.lng.toFixed(5) : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
              
              {data.isStation && data.provider && (
                <Typography variant="body2" color="text.secondary">
                  Provider: {data.provider}
                </Typography>
              )}
              {data.isStation && data.stationType && (
                <Typography variant="body2" color="text.secondary">
                  Station Type: {data.stationType}
                </Typography>
              )}
              {data.isStation && data.instrument && (
                <Typography variant="body2" color="text.secondary">
                  Instrument: {data.instrument}
                </Typography>
              )}
              {data.isStation && data.timezone && (
                <Typography variant="body2" color="text.secondary">
                  Timezone: {data.timezone}
                </Typography>
              )}
            </Box>

            {/* AQI 顯示 */}
            {aqiData && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Air Quality Index
                </Typography>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    backgroundColor: getAQIInfo(aqiData.aqi).color,
                    color: getAQIInfo(aqiData.aqi).textColor,
                    textAlign: 'center',
                    mt: 0.5
                  }}
                >
                  <Typography variant="h4" fontWeight="bold">
                    {aqiData.aqi}
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {getAQIInfo(aqiData.aqi).level}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Dominant: {aqiData.dominantPollutant.toUpperCase()}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* ML Prediction 顯示 - 只在有數據或正在載入時顯示 */}
            {(mlPredictionLoading || (mlPrediction && mlPrediction.result?.AQI !== undefined && mlPrediction.result?.AQI !== null)) && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  ML Predicted AQI (Next Hour)
                </Typography>
                {mlPredictionLoading ? (
                  <Paper 
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: 'rgba(117, 117, 117, 0.1)',
                      textAlign: 'center',
                      mt: 0.5
                    }}
                  >
                    <CircularProgress size={24} />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      Predicting...
                    </Typography>
                  </Paper>
                ) : mlPrediction && mlPrediction.result?.AQI !== undefined && mlPrediction.result?.AQI !== null ? (
                  <Paper 
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: getAQIInfo(mlPrediction.result.AQI).color,
                      color: getAQIInfo(mlPrediction.result.AQI).textColor,
                      textAlign: 'center',
                      mt: 0.5
                    }}
                  >
                    <Typography variant="h4" fontWeight="bold">
                      {mlPrediction.result.AQI}
                    </Typography>
                    <Typography variant="body2" fontWeight="600">
                      {getAQIInfo(mlPrediction.result.AQI).level}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Dominant: {mlPrediction.result?.Dominant?.toUpperCase() || 'N/A'}
                    </Typography>
                    
                    {/* 詳細污染物預測 */}
                    {mlPrediction.result?.Detail && (
                      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                        <Grid container spacing={1} sx={{ justifyContent: 'center' }}>
                          {Object.entries(mlPrediction.result.Detail).map(([pollutant, value]) => (
                            <Grid item xs={4} key={pollutant}>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.8, textAlign: 'center', display: 'block' }}>
                                {pollutant.toUpperCase()}: {value}
                              </Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </Paper>
                ) : (
                  <Paper 
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      textAlign: 'center',
                      mt: 0.5
                    }}
                  >
                    <Typography variant="caption" color="error.main">
                      Prediction unavailable
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* 衛星數據區域 */}
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              bgcolor: 'rgba(33, 150, 243, 0.05)', 
              borderRadius: 2,
              border: '1px solid rgba(33, 150, 243, 0.2)'
            }}>
              <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 2, color: 'primary.main' }}>
                🛰️ Satellite Data
              </Typography>
              
              {/* TEMPO NO2 衛星數據顯示 */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  TEMPO NO₂
                </Typography>
                
                {data.loadingTempoData ? (
                  <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, textAlign: 'center' }}>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary" display="inline">
                      Loading satellite data...
                    </Typography>
                  </Paper>
                ) : data.tempoData ? (
                  <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5 }}>
                    {/* 轉換後的地表濃度 - 簡化格式 */}
                    {(() => {
                      const conversion = convertTEMPOColumnToPPB(data.tempoData.value);
                      return conversion ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body1" fontWeight="600">
                              {data.tempoData.value.toExponential(2)} mol/cm² → {conversion.ppb.toFixed(1)} ppb
                            </Typography>
                            <Chip 
                              label="NO₂" 
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                          
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Confidence: {(conversion.confidence * 100).toFixed(0)}% | TEMPO satellite observation
                          </Typography>
                          
                          {/* 顯示 TEMPO 實際觀測時間 */}
                          {data.tempoData.observationTime && (
                            <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}>
                              🛰️ Observed: {new Date(data.tempoData.observationTime).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZoneName: 'short'
                              })}
                            </Typography>
                          )}
                          
                          {conversion.uncertainty && (
                            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                              ⚠️ {conversion.uncertainty}
                            </Typography>
                          )}
                        </Box>
                      ) : null;
                    })()}
                  </Paper>
                ) : (
                  <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      No TEMPO satellite data available for this location
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Box>

            {/* 地面站數據區域 */}
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              bgcolor: 'rgba(76, 175, 80, 0.05)', 
              borderRadius: 2,
              border: '1px solid rgba(76, 175, 80, 0.2)'
            }}>
              <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 2, color: 'success.main' }}>
                🏢 Ground Station Data
              </Typography>

              {/* Sensor 資料顯示 */}
              {data.isStation && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    Real-time Measurements
                  </Typography>

                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        Loading sensor data...
                      </Typography>
                    </Box>
                  ) : sensorData.length > 0 ? (
                    <Box>
                      <Typography variant="caption" color="success.main" sx={{ mb: 1 }}>
                        Successfully loaded {sensorData.length} sensors
                      </Typography>
                      {sensorData.map((item, index) => (
                        <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Chip
                              label={item.sensor.parameter_display_name || item.sensor.parameter_name}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </Box>

                          {item.data ? (
                            <Box>
                              {(() => {
                                const paramName = item.sensor.parameter_name?.toLowerCase();
                                const originalValue = item.data.latest?.value;
                                
                                // 處理單位轉換
                                let displayValue = originalValue;
                                let displayUnit = item.sensor.parameter_units;
                                
                                if (paramName === 'no2') {
                                  displayValue = convertNO2ToPPB(originalValue, item.sensor.parameter_units);
                                  displayUnit = 'ppb';
                                } else if (paramName === 'o3') {
                                  displayValue = convertO3ToPPM(originalValue, item.sensor.parameter_units);
                                  displayUnit = 'ppm';
                                } else if (paramName === 'so2') {
                                  displayValue = convertSO2ToPPB(originalValue, item.sensor.parameter_units);
                                  displayUnit = 'ppb';
                                }
                                
                                // 完全保留數值精度的格式化函數
                                const formatValue = (value) => {
                                  if (typeof value !== 'number') return value;
                                  
                                  // 完全保留原始精度，但限制顯示格式
                                  const valueStr = value.toString();
                                  
                                  // 如果數值很小或很大，使用科學記號
                                  if ((Math.abs(value) < 0.001 || Math.abs(value) >= 100000) && 
                                      value !== 0 && !valueStr.includes('e')) {
                                    return value.toExponential(6);
                                  }
                                  
                                  // 如果原始值已經是科學記號格式，直接返回
                                  if (valueStr.includes('e')) {
                                    return valueStr;
                                  }
                                  
                                  // 對於一般數值，限制最多顯示6位小數
                                  if (valueStr.includes('.')) {
                                    const [intPart, decPart] = valueStr.split('.');
                                    if (decPart.length > 6) {
                                      return `${intPart}.${decPart.substring(0, 6)}`;
                                    }
                                  }
                                  
                                  // 其他情況直接返回原始數值字串
                                  return valueStr;
                                };
                                
                                return (
                                  <>
                                    <Typography variant="h6" fontWeight="600">
                                      {formatPollutantValue(displayValue, paramName)} {displayUnit}
                                    </Typography>
                                    
                                    {/* 對於 NO2、O3、SO2 顯示原始值和轉換說明 */}
                                    {['no2', 'o3', 'so2'].includes(paramName) && originalValue !== displayValue && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Original: {formatPollutantValue(originalValue, paramName)} {item.sensor.parameter_units} → {formatPollutantValue(displayValue, paramName)} {displayUnit}
                                      </Typography>
                                    )}
                                    
                                    <Typography variant="caption" color="text.secondary">
                                      {item.data.latest?.datetime?.local ?
                                        new Date(item.data.latest.datetime.local).toLocaleString() :
                                        'No timestamp'
                                      }
                                    </Typography>
                                    
                                    {item.data.summary && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Avg: {formatPollutantValue(item.data.summary.avg, paramName)} |
                                        Min: {formatPollutantValue(item.data.summary.min, paramName)} |
                                        Max: {formatPollutantValue(item.data.summary.max, paramName)}
                                        {['no2', 'o3', 'so2'].includes(paramName) ? ` ${item.sensor.parameter_units}` : ''}
                                      </Typography>
                                    )}
                                  </>
                                );
                              })()}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="error">
                              {item.error || 'No data available'}
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  ) : data.sensors && data.sensors.length > 0 ? (
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Station has {data.sensors.length} sensors. Showing data for PM2.5, PM10, O3, CO, SO2, and NO2 only.
                        No target pollutant sensors found at this station.
                      </Typography>
                    </Paper>
                  ) : data.stationType === 'Pandora' ? (
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Pandora stations provide atmospheric composition data. 
                        Real-time sensor data integration coming soon.
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No sensors available for this station.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}

              {/* 附近監測站空氣品質數據 */}
              {!data.isStation && (data.nearbyStationsData || data.loadingNearbyData) && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    Air Quality in 10km Radius
                  </Typography>
                  
                  {data.loadingNearbyData ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        Loading nearby station data...
                      </Typography>
                    </Box>
                  ) : data.nearbyStationsData && data.nearbyStationsData.nearbyStationsCount > 0 ? (
                    <Box>
                      <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                        Found {data.nearbyStationsData.nearbyStationsCount} monitoring stations within 10km
                      </Typography>
                      
                      {/* 顯示監測站類型分布 */}
                      {(data.nearbyStationsData.openaqStationsCount > 0 || data.nearbyStationsData.pandoraStationsCount > 0) && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                          {data.nearbyStationsData.openaqStationsCount > 0 && `${data.nearbyStationsData.openaqStationsCount} OpenAQ stations`}
                          {data.nearbyStationsData.openaqStationsCount > 0 && data.nearbyStationsData.pandoraStationsCount > 0 && ' • '}
                          {data.nearbyStationsData.pandoraStationsCount > 0 && `${data.nearbyStationsData.pandoraStationsCount} Pandora stations`}
                        </Typography>
                      )}

                      {/* 顯示指定污染物的最大值 */}
                      {Object.entries(data.nearbyStationsData.pollutantData)
                        .filter(([pollutant, pollutantInfo]) => pollutantInfo.values.length > 0)
                        .map(([pollutant, pollutantInfo]) => {
                          // 完全保留數值精度的格式化函數
                          const formatValue = (value) => {
                            if (typeof value !== 'number') return value;
                            
                            // 完全保留原始精度，但限制顯示格式
                            const valueStr = value.toString();
                            
                            // 如果數值很小或很大，使用科學記號
                            if ((Math.abs(value) < 0.001 || Math.abs(value) >= 100000) && 
                                value !== 0 && !valueStr.includes('e')) {
                              return value.toExponential(6);
                            }
                            
                            // 如果原始值已經是科學記號格式，直接返回
                            if (valueStr.includes('e')) {
                              return valueStr;
                            }
                            
                            // 對於一般數值，限制最多顯示6位小數
                            if (valueStr.includes('.')) {
                              const [intPart, decPart] = valueStr.split('.');
                              if (decPart.length > 6) {
                                return `${intPart}.${decPart.substring(0, 6)}`;
                              }
                            }
                            
                            // 其他情況直接返回原始數值字串
                            return valueStr;
                          };
                          
                          return (
                            <Paper key={pollutant} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Chip
                                  label={pollutant.toUpperCase()}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  ({pollutantInfo.values.length} sensors)
                                </Typography>
                              </Box>

                              <Typography variant="h6" fontWeight="600">
                                {pollutantInfo.max !== null ? formatPollutantValue(pollutantInfo.max, pollutant) : '—'} {pollutantInfo.unit || 'μg/m³'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {pollutantInfo.max !== null 
                                  ? `From the maximum of ${pollutantInfo.values.length} active sensor${pollutantInfo.values.length > 1 ? 's' : ''}`
                                  : 'No recent data available'
                                }
                              </Typography>
                              
                              {/* 顯示數據來源分布 */}
                              {pollutantInfo.stations && pollutantInfo.stations.length > 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Sources: {(() => {
                                    const sources = pollutantInfo.stations.reduce((acc, station) => {
                                      const source = station.source || 'openaq';
                                      acc[source] = (acc[source] || 0) + 1;
                                      return acc;
                                    }, {});
                                    
                                    return Object.entries(sources)
                                      .map(([source, count]) => `${count} ${source.toUpperCase()}`)
                                      .join(', ');
                                  })()}
                                </Typography>
                              )}
                            </Paper>
                          );
                        })}

                      {/* 如果沒有任何污染物數據 */}
                      {Object.values(data.nearbyStationsData.pollutantData).every(p => p.values.length === 0) && (
                        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No PM2.5, PM10, O3, CO, SO2, or NO2 data available from nearby stations.
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  ) : (
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No monitoring stations found within 10km radius.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}

              {/* 預留空間給沒有附近監測站數據的情況 */}
              {!data.isStation && !data.nearbyStationsData && !data.loadingNearbyData && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    Air Quality
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Click anywhere on the map to explore local air quality data.
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* 圖層控制 - 始終顯示在最下方 */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1, fontSize: '0.9rem' }}>
            Map Layers
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showTempoLayer}
                  onChange={(event) => onToggleTempoLayer(event.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  TEMPO NO₂
                </Typography>
              }
              sx={{ 
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  ml: 0.5
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showOpenAQLayer}
                  onChange={(event) => onToggleOpenAQLayer(event.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  OpenAQ
                </Typography>
              }
              sx={{ 
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  ml: 0.5
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showPandoraLayer}
                  onChange={(event) => onTogglePandoraLayer(event.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  Pandora
                </Typography>
              }
              sx={{ 
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  ml: 0.5
                }
              }}
            />
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
