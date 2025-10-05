# Cloudflare Worker CORS Proxy

這個 Cloudflare Worker 為 Aircast 項目提供 CORS 代理服務，解決跨來源請求問題。

## 部署步驟

### 1. 安裝 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登入 Cloudflare

```bash
wrangler login
```

### 3. 部署 Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### 4. 取得 Worker URL

部署完成後，你會得到一個類似以下的 URL：
```
https://your-worker-name.your-subdomain.workers.dev
```

## 使用方式

### ML API 代理

**原始 API：**
```
http://167.179.86.141:8000/predict_aqi?station_id=221
```

**透過 CORS Proxy：**
```
https://your-worker-name.your-subdomain.workers.dev/api/ml/predict_aqi?station_id=221
```

## 修改應用程式程式碼

在 `src/InfoPanel.jsx` 中，將 API 調用改為：

```javascript
// 將這行：
const response = await fetch(`/api/ml/predict_aqi?station_id=${stationId}`);

// 改為：
const response = await fetch(`https://your-worker-name.your-subdomain.workers.dev/api/ml/predict_aqi?station_id=${stationId}`);
```

## 測試

你可以在瀏覽器中直接測試：
```
https://your-worker-name.your-subdomain.workers.dev/api/ml/predict_aqi?station_id=221
```

## 特色

- ✅ 解決 CORS 問題
- ✅ 支援所有 HTTP 方法
- ✅ 自動處理 OPTIONS 預檢請求
- ✅ 錯誤處理和日誌記錄
- ✅ 免費使用（Cloudflare Workers 免費額度）

## 安全性

這個代理服務目前允許來自任何來源的請求。如果需要更嚴格的安全性，可以修改 `corsHeaders` 中的 `Access-Control-Allow-Origin` 設定。