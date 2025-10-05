/**
 * Cloudflare Worker CORS Proxy Server
 * 專為 Aircast 項目的 ML API 設計
 */

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization, X-Requested-With, x-api-key, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 處理 OPTIONS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request),
      });
    }

    // 檢查是否為 API 請求
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, url);
    }

    // 預設回應
    return new Response(
      JSON.stringify({
        message: 'Aircast CORS Proxy Server',
        usage: {
          ml: 'Use /api/ml/* to proxy ML API requests',
          openaq: 'Use /api/openaq/* to proxy OpenAQ API requests',
          pandora: 'Use /api/pandora/* to proxy Pandora API requests'
        },
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(request),
        },
      }
    );
  },
};

async function handleApiRequest(request, url) {
  try {
    // 移除 /api 前綴並建構目標 URL
    const targetPath = url.pathname.replace('/api', '');
    let targetUrl;

    if (targetPath.startsWith('/ml/')) {
      // ML API 代理
      const mlPath = targetPath.replace('/ml', '');
      targetUrl = `http://167.179.86.141:8000${mlPath}${url.search}`;
    } else if (targetPath.startsWith('/openaq/')) {
      // OpenAQ API 代理
      const openaqPath = targetPath.replace('/openaq', '');
      targetUrl = `https://api.openaq.org${openaqPath}${url.search}`;
    } else if (targetPath.startsWith('/pandora/')) {
      // Pandora API 代理
      const pandoraPath = targetPath.replace('/pandora', '');
      targetUrl = `https://data.hetzner.pandonia-global-network.org${pandoraPath}${url.search}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown API endpoint' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(request),
          },
        }
      );
    }

    console.log(`Proxying request to: ${targetUrl}`);
    console.log('Request method:', request.method);
    console.log('Original headers:', [...request.headers.entries()]);

    // 建立新的請求標頭，過濾掉會導致上游拒絕的欄位
    const headersToStrip = new Set([
      'host',
      'origin',
      'referer',
      'cf-connecting-ip',
      'cf-ipcountry',
      'cf-ray',
      'cf-visitor',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-real-ip',
      'content-length'
    ]);

    const newHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (headersToStrip.has(key.toLowerCase())) {
        continue;
      }
      newHeaders.set(key, value);
    }

    // 確保預設接受 JSON 回應
    if (!newHeaders.has('accept')) {
      newHeaders.set('Accept', 'application/json, text/plain, */*');
    }

    // 為所有請求添加瀏覽器 User-Agent 以避免被阻擋
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 為 ML API 添加額外的標頭
    if (targetPath.startsWith('/ml/')) {
      newHeaders.set('Referer', 'https://aircast68332.workers.dev/');
      newHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    }

    // 為 OpenAQ API 添加 User-Agent
    if (targetPath.startsWith('/openaq/')) {
      newHeaders.set('User-Agent', 'Aircast/1.0.0');
    }

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // 發送請求到目標伺服器
    console.log('Sending request with headers:', [...newHeaders.entries()]);
    const response = await fetch(proxyRequest);
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    // 複製回應並添加 CORS 標頭
    const proxyResponseHeaders = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders(request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      proxyResponseHeaders.set(key, value);
    }

    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyResponseHeaders,
    });

    return proxyResponse;

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Proxy request failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(request),
        },
      }
    );
  }
}
