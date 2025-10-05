export const middleOfUSA = [-100, 40];

// 處理路徑的函數，自動檢測是否在 GitHub Pages 環境
export const getBasePath = () => {
  const currentHost = window.location.hostname;
  // 如果在 GitHub Pages (github.io) 或路徑包含 tempo-aqi-web
  if (currentHost.includes('github.io') || window.location.pathname.includes('/Aircast/')) {
    return '/Aircast';
  }
  return '';
};

// 獲取完整的資源路徑
export const getAssetPath = (path) => {
  const basePath = getBasePath();
  // 確保路徑以 / 開頭
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
};
