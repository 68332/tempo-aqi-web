// TEMPO 衛星資料相關的工具函數
import { getAssetPath } from '../lib/constants.js';

// 獲取 TEMPO 觀測時間
export const getTEMPOObservationTime = async () => {
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

// 獲取指定座標的 TEMPO NO2 數值
export const getTEMPOValue = async (lng, lat, zoom = 8) => {
  try {
    // 計算對應的 tile 座標
    const tileZ = Math.min(zoom, 8); // 最大 zoom 是 8
    const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, tileZ));
    const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, tileZ));
    
    // 構建 tile URL
    const tileUrl = `${window.location.origin}${getAssetPath('/tempo/tiles')}/${tileZ}/${tileX}/${tileY}.png`;
    
    // 計算在 tile 內的像素位置
    const tileSize = 256;
    const pixelX = Math.floor(((lng + 180) / 360 * Math.pow(2, tileZ) - tileX) * tileSize);
    const pixelY = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, tileZ) - tileY) * tileSize);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // 創建 canvas 來讀取像素數據
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // 獲取指定像素的 RGBA 值
          const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
          const [r, g, b, a] = imageData.data;
          
          // 如果是透明像素，表示沒有數據
          if (a === 0) {
            resolve(null);
            return;
          }
          
          // 根據顏色映射估算 NO2 濃度
          // 這是基於我們之前設定的顏色映射的反向計算
          const intensity = (r + g + b) / 3; // 簡化的強度計算
          const normalizedValue = intensity / 255;
          
          // 假設數據範圍是 0 到 5e15 molecules/cm²
          const estimatedValue = normalizedValue * 5e15;
          
          // 獲取實際觀測時間
          getTEMPOObservationTime().then(observationTime => {
            resolve({
              value: estimatedValue,
              unit: 'molecules/cm²',
              coordinates: { lng, lat },
              tileInfo: { z: tileZ, x: tileX, y: tileY, pixelX, pixelY },
              rgba: { r, g, b, a },
              observationTime: observationTime, // TEMPO 實際觀測時間
              dataType: 'TEMPO NO2'
            });
          }).catch(error => {
            console.error('Error getting observation time:', error);
            // 如果獲取時間失敗，仍然返回數據但沒有時間
            resolve({
              value: estimatedValue,
              unit: 'molecules/cm²',
              coordinates: { lng, lat },
              tileInfo: { z: tileZ, x: tileX, y: tileY, pixelX, pixelY },
              rgba: { r, g, b, a },
              dataType: 'TEMPO NO2'
            });
          });
        } catch (error) {
          console.error('Error reading pixel data:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.log('TEMPO tile not found or failed to load');
        resolve(null);
      };
      
      img.src = tileUrl;
    });
  } catch (error) {
    console.error('Error getting TEMPO value:', error);
    return null;
  }
};