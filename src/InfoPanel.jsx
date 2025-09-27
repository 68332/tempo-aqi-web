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
  Chip
} from '@mui/material';

export default function InfoPanel({ open, data, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 狀態管理
  const [sensorData, setSensorData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // 當 data 改變且有 sensors 時，獲取 sensor 資料
  React.useEffect(() => {
    if (data && data.sensors && data.sensors.length > 0) {
      console.log('Fetching data for sensors:', data.sensors); // Debug
      fetchSensorData(data.sensors);
    } else {
      setSensorData([]);
    }
  }, [data]);

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
      // 確保 sensors 是陣列並限制只處理前 10 個 sensors 來避免 rate limit
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

      console.log('Parsed sensorsArray:', sensorsArray);
      const limitedSensors = sensorsArray.slice(0, 10);
      console.log(`Processing ${limitedSensors.length} out of ${sensorsArray.length} sensors`);

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
          borderColor: 'divider'
        }}
      >
        <Typography variant="h6" component="h2" fontWeight="bold">
          United States Air Quality
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
        {!data ? (
          <Typography variant="body2" color="text.secondary">
            Click within the United States to see details.
          </Typography>
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
                              {item.data.latest?.value} {item.sensor.parameter_units}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.data.latest?.datetime?.local ?
                                new Date(item.data.latest.datetime.local).toLocaleString() :
                                'No timestamp'
                              }
                            </Typography>
                            {item.data.summary && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                Avg: {item.data.summary.avg?.toFixed(2)} |
                                Min: {item.data.summary.min} |
                                Max: {item.data.summary.max}
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
                      Station has {data.sensors.length} sensors.
                      請在 InfoPanel.jsx 中設定 OpenAQ API key 來查看即時資料。
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

            {/* 預留空間給 TEMPO/地面站/天氣資訊 */}
            {!data.isStation && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                  Air Quality (placeholder)
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                  <Typography variant="body2">AQI: —</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Source: —
                  </Typography>
                </Paper>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                  Weather (placeholder)
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2">
                    Temp: — °C<br />
                    Wind: — m/s
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
