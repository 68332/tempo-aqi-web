// src/InfoPanel.jsx
import * as React from 'react';
import {
  Paper,
  Typography,
  Box,
  Divider,
  Grid,
  useMediaQuery,
  useTheme
} from '@mui/material';

export default function InfoPanel({ open, data, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
          Location Details
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
            </Box>

            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Latitude
                </Typography>
                <Typography variant="body2">
                  {data.lat.toFixed(5)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Longitude
                </Typography>
                <Typography variant="body2">
                  {data.lng.toFixed(5)}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* 預留空間給 TEMPO/地面站/天氣資訊 */}
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
          </Box>
        )}
      </Box>
    </Paper>
  );
}
