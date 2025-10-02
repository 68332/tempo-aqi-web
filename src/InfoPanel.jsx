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
  showTOLNetLayer, 
  onToggleTOLNetLayer 
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 狀態管理
  const [sensorData, setSensorData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [nearbyDataLoading, setNearbyDataLoading] = React.useState(false);
  const [titleKey, setTitleKey] = React.useState(0);
  const [aqiData, setAqiData] = React.useState(null);

  // 當 data 改變時觸發標題動畫
  React.useEffect(() => {
    setTitleKey(prev => prev + 1);
  }, [!!data]);

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
    // 只有 OpenAQ 監測站才獲取 sensor 資料
    if (data && data.stationType === 'OpenAQ' && data.sensors && data.sensors.length > 0) {
      console.log('Fetching data for sensors:', data.sensors); // Debug
      fetchSensorData(data.sensors);
    } else {
      console.log('sensorData changed:', []); // Debug 用
      setSensorData([]);
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

  // 計算 AQI 當有附近監測站數據、sensor 數據或 TEMPO 數據時
  React.useEffect(() => {
    console.log('AQI calculation useEffect triggered:', {
      hasNearbyData: !!data?.nearbyStationsData?.pollutantData,
      sensorDataLength: sensorData.length,
      hasTempoData: !!data?.tempoData,
      tempoValue: data?.tempoData?.value
    });

    if (data?.nearbyStationsData?.pollutantData) {
      // 複製附近站點的污染物數據
      const pollutantData = { ...data.nearbyStationsData.pollutantData };
      console.log('Original nearby stations pollutant data:', pollutantData);
      
      // 如果有 TEMPO 數據，加入或更新 NO2
      if (data?.tempoData) {
        const tempoConversion = convertTEMPOColumnToPPB(data.tempoData.value);
        console.log('TEMPO conversion for nearby stations case:', tempoConversion);
        
        if (tempoConversion && tempoConversion.ppb > 0) {
          if (!pollutantData.no2) {
            pollutantData.no2 = { max: 0, values: [], unit: 'ppb', source: 'ground' };
          }
          
          // 如果衛星數據更高，或者沒有地面 NO2 數據，使用衛星數據
          if (pollutantData.no2.values.length === 0 || tempoConversion.ppb > pollutantData.no2.max) {
            pollutantData.no2.max = tempoConversion.ppb;
            pollutantData.no2.values = [tempoConversion.ppb];
            pollutantData.no2.source = 'satellite';
            pollutantData.no2.unit = 'ppb';
          }
          console.log('Updated pollutant data with TEMPO NO2:', pollutantData);
        }
      }
      
      const aqiResult = calculateAQI(pollutantData);
      console.log('Calculated AQI from nearby stations (with TEMPO):', aqiResult);
      setAqiData(aqiResult);
    } else if (sensorData.length > 0) {
      // 對於單一監測站，從 sensor 數據計算 AQI
      const pollutantData = {};
      sensorData.forEach(item => {
        if (item.data?.latest?.value !== null && item.data?.latest?.value !== undefined) {
          const paramName = item.sensor.parameter_name?.toLowerCase();
          if (['pm25', 'pm10', 'o3', 'co', 'so2', 'no2'].includes(paramName)) {
            let value = item.data.latest.value;
            
            // 對於 NO2，確保轉換為 ppb 用於 AQI 計算
            if (paramName === 'no2') {
              value = convertNO2ToPPB(value, item.sensor.parameter_units);
            }
            
            pollutantData[paramName] = {
              max: value,
              values: [value],
              unit: paramName === 'no2' ? 'ppb' : item.sensor.parameter_units,
              source: 'ground'
            };
          }
        }
      });
      
      // 如果有 TEMPO 數據，加入 NO2
      if (data?.tempoData) {
        const tempoConversion = convertTEMPOColumnToPPB(data.tempoData.value);
        if (tempoConversion && tempoConversion.ppb > 0) {
          pollutantData.no2 = pollutantData.no2 || { max: 0, values: [] };
          // 如果沒有地面 NO2 數據，或者衛星數據更高，使用衛星數據
          if (!pollutantData.no2.values.length || tempoConversion.ppb > pollutantData.no2.max) {
            pollutantData.no2.max = tempoConversion.ppb;
            pollutantData.no2.values = [tempoConversion.ppb];
            pollutantData.no2.source = 'satellite';
          }
        }
      }
      
      const aqiResult = calculateAQI(pollutantData);
      console.log('Calculated AQI from sensors:', aqiResult);
      setAqiData(aqiResult);
    } else if (data?.tempoData) {
      // 只有 TEMPO 數據時，嘗試計算基於衛星 NO2 的 AQI
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
  }, [data?.nearbyStationsData, sensorData, data?.tempoData]);

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
          // 使用代理路徑來避免 CORS 問題
          const response = await fetch(`/api/openaq/v3/sensors/${sensor.id}`, {
            headers: {
              'x-api-key': API_KEY  // 改用小寫的 header 名稱
            }
          });
          console.log(`Sensor ${sensor.id} response:`, response.status); // Debug
          if (response.ok) {
            const result = await response.json();
            console.log(`Sensor ${sensor.id} data:`, result); // Debug
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • <strong>OpenAQ</strong> - Ground-based air quality monitoring network
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • <strong>Pandora</strong> - Atmospheric composition measurement stations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • <strong>TOLNet</strong> - Tropospheric Ozone Lidar Network
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click anywhere on the map to explore local air quality data from these monitoring stations.
            </Typography>

            {/* 圖層控制 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1 }}>
                Map Layers
              </Typography>
              
              {/* TEMPO NO₂ 衛星數據 */}
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
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      TEMPO NO₂ Satellite Data
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Real-time nitrogen dioxide measurements from space
                    </Typography>
                  </Box>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  mb: 1,
                  '& .MuiFormControlLabel-label': {
                    ml: 1
                  }
                }}
              />

              {/* OpenAQ 監測站 */}
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
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      OpenAQ Ground Stations
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ground-based air quality monitoring network
                    </Typography>
                  </Box>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  mb: 1,
                  '& .MuiFormControlLabel-label': {
                    ml: 1
                  }
                }}
              />

              {/* Pandora 監測站 */}
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
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Pandora Stations
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Atmospheric composition measurement stations
                    </Typography>
                  </Box>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  mb: 1,
                  '& .MuiFormControlLabel-label': {
                    ml: 1
                  }
                }}
              />

              {/* TOLNet 監測站 */}
              <FormControlLabel
                control={
                  <Switch
                    checked={showTOLNetLayer}
                    onChange={(event) => onToggleTOLNetLayer(event.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      TOLNet Stations
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tropospheric Ozone Lidar Network
                    </Typography>
                  </Box>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  '& .MuiFormControlLabel-label': {
                    ml: 1
                  }
                }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />
          </Box>
        ) : (
          <Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {data.isStation ? 'Station' : 'State'}
              </Typography>
              <Typography variant="h6" fontWeight="600">
                {data.isStation ? data.stationName : data.stateName}
              </Typography>
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

            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid size={6}>
                <Typography variant="caption" color="text.secondary">
                  Latitude
                </Typography>
                <Typography variant="body2">
                  {data.lat.toFixed(5)}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="caption" color="text.secondary">
                  Longitude
                </Typography>
                <Typography variant="body2">
                  {data.lng.toFixed(5)}
                </Typography>
              </Grid>
            </Grid>

            {/* 圖層控制 - 在選中數據時也顯示 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1, fontSize: '0.8rem' }}>
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
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
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
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
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
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
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
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={showTOLNetLayer}
                      onChange={(event) => onToggleTOLNetLayer(event.target.checked)}
                      size="small"
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      TOLNet
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
                            Confidence: {(conversion.confidence * 100).toFixed(0)}% | Real-time from TEMPO satellite
                          </Typography>
                          
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
                                const isNO2 = paramName === 'no2';
                                const originalValue = item.data.latest?.value;
                                const displayValue = isNO2 ? convertNO2ToPPB(originalValue, item.sensor.parameter_units) : originalValue;
                                const displayUnit = isNO2 ? 'ppb' : item.sensor.parameter_units;
                                
                                return (
                                  <>
                                    <Typography variant="h6" fontWeight="600">
                                      {typeof displayValue === 'number' ? 
                                        displayValue.toFixed(6) : 
                                        displayValue} {displayUnit}
                                    </Typography>
                                    
                                    {/* 對於 NO2 顯示原始值和轉換說明 */}
                                    {isNO2 && originalValue !== displayValue && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Original: {originalValue?.toFixed(6)} {item.sensor.parameter_units} → {displayValue?.toFixed(6)} ppb
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
                                        Avg: {typeof item.data.summary.avg === 'number' ? item.data.summary.avg.toFixed(6) : item.data.summary.avg} |
                                        Min: {typeof item.data.summary.min === 'number' ? item.data.summary.min.toFixed(6) : item.data.summary.min} |
                                        Max: {typeof item.data.summary.max === 'number' ? item.data.summary.max.toFixed(6) : item.data.summary.max}
                                        {isNO2 ? ` ${item.sensor.parameter_units}` : ''}
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
                      <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
                        Found {data.nearbyStationsData.nearbyStationsCount} monitoring stations within 10km
                      </Typography>

                      {/* 顯示指定污染物的最大值 */}
                      {Object.entries(data.nearbyStationsData.pollutantData)
                        .filter(([pollutant, pollutantInfo]) => pollutantInfo.values.length > 0)
                        .map(([pollutant, pollutantInfo]) => (
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
                              {pollutantInfo.max !== null ? pollutantInfo.max.toFixed(6) : '—'} {pollutantInfo.unit || 'μg/m³'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {pollutantInfo.max !== null 
                                ? `From the maximum of ${pollutantInfo.values.length} active sensor${pollutantInfo.values.length > 1 ? 's' : ''}`
                                : 'No recent data available'
                              }
                            </Typography>
                          </Paper>
                        ))}

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
      </Box>
    </Paper>
  );
}
