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

export default function InfoPanel({ open, data, onClose, showTempoLayer, onToggleTempoLayer }) {
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
      if (!breakpoints || concentration === null || concentration === undefined) return null;

      for (const bp of breakpoints) {
        if (concentration >= bp.lo && concentration <= bp.hi) {
          const aqi = Math.round(
            ((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (concentration - bp.lo) + bp.aqiLo
          );
          return aqi;
        }
      }
      return null;
    };

    let maxAqi = 0;
    let dominantPollutant = '';
    const individualAqis = {};

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

  // 計算 AQI 當有附近監測站數據或 sensor 數據時
  React.useEffect(() => {
    if (data?.nearbyStationsData?.pollutantData) {
      const aqiResult = calculateAQI(data.nearbyStationsData.pollutantData);
      console.log('Calculated AQI:', aqiResult);
      setAqiData(aqiResult);
    } else if (sensorData.length > 0) {
      // 對於單一監測站，從 sensor 數據計算 AQI
      const pollutantData = {};
      sensorData.forEach(item => {
        if (item.data?.latest?.value !== null && item.data?.latest?.value !== undefined) {
          const paramName = item.sensor.parameter_name?.toLowerCase();
          if (['pm25', 'pm10', 'o3', 'co', 'so2', 'no2'].includes(paramName)) {
            pollutantData[paramName] = {
              max: item.data.latest.value,
              values: [item.data.latest.value]
            };
          }
        }
      });
      const aqiResult = calculateAQI(pollutantData);
      console.log('Calculated AQI from sensors:', aqiResult);
      setAqiData(aqiResult);
    } else {
      setAqiData(null);
    }
  }, [data?.nearbyStationsData, sensorData]);

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
                    TEMPO NO₂ Layer
                  </Typography>
                }
                sx={{ 
                  '& .MuiFormControlLabel-label': {
                    ml: 1
                  }
                }}
              />
            </Box>

            {/* AQI 顯示 */}
            {aqiData && (
              <Box sx={{ mb: 2 }}>
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

            {/* Sensor 資料顯示 */}
            {data.isStation && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                  Sensor Data
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
                            color="primary"
                            variant="outlined"
                          />
                        </Box>

                        {item.data ? (
                          <Box>
                            <Typography variant="h6" fontWeight="600">
                              {typeof item.data.latest?.value === 'number' ? 
                                item.data.latest.value.toFixed(3) : 
                                item.data.latest?.value} {item.sensor.parameter_units}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.data.latest?.datetime?.local ?
                                new Date(item.data.latest.datetime.local).toLocaleString() :
                                'No timestamp'
                              }
                            </Typography>
                            {item.data.summary && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                Avg: {typeof item.data.summary.avg === 'number' ? item.data.summary.avg.toFixed(3) : item.data.summary.avg} |
                                Min: {typeof item.data.summary.min === 'number' ? item.data.summary.min.toFixed(3) : item.data.summary.min} |
                                Max: {typeof item.data.summary.max === 'number' ? item.data.summary.max.toFixed(3) : item.data.summary.max}
                              </Typography>
                            )}
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
                              color="primary"
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              ({pollutantInfo.values.length} sensors)
                            </Typography>
                          </Box>

                          <Typography variant="h6" fontWeight="600">
                            {pollutantInfo.max !== null ? pollutantInfo.max.toFixed(1) : '—'} {pollutantInfo.unit || 'μg/m³'}
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
        )}
      </Box>
    </Paper>
  );
}
