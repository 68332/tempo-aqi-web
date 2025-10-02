import requests
import os
from pathlib import Path
from urllib.parse import urlparse
import getpass
import xarray as xr
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
import numpy as np
import subprocess


def _build_color_ramp():
    """建立 0-255 的平滑顏色表 (RGBA)。"""
    anchors = [
        (0, (0, 0, 0, 0)),            # 透明背景
        (1, (0, 0, 140, 255)),        # 深藍
        (64, (0, 120, 255, 255)),     # 藍
        (128, (0, 255, 170, 255)),    # 綠
        (192, (255, 255, 0, 255)),    # 黃
        (255, (255, 0, 0, 255)),      # 紅
    ]

    ramp = {}
    for (start_idx, start_col), (end_idx, end_col) in zip(anchors[:-1], anchors[1:]):
        span = max(end_idx - start_idx, 1)
        for i in range(span):
            t = i / span
            rgba = tuple(
                int(round(start_col[channel] + t * (end_col[channel] - start_col[channel])))
                for channel in range(4)
            )
            ramp[start_idx + i] = rgba
    ramp[anchors[-1][0]] = anchors[-1][1]
    return ramp

# 允許透過環境變數覆寫 NetCDF 引擎，預設沿用 h5netcdf 以支援 NetCDF4 群組
NETCDF_ENGINE = os.environ.get("TEMPO_NETCDF_ENGINE", "h5netcdf")

# 載入 .env 檔案的簡單實作
def load_env_file():
    """簡單的 .env 檔案載入器"""
    # 嘗試多個可能的 .env 檔案位置
    possible_paths = [
        Path(".env"),          # 當前目錄
        Path("../.env"),       # 上一層目錄（專案根目錄）
        Path("../.env.local"), # 上一層目錄的 .env.local
    ]
    
    for env_file in possible_paths:
        if env_file.exists():
            print(f"載入環境變數檔案: {env_file}")
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
            return
    
    print("未找到 .env 檔案")

# 載入環境變數
load_env_file()

CMR_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
PARAMS = {
    "echo_collection_id": "C3685668637-LARC_CLOUD",  # TEMPO NO2 Gridded 新集合
    "sort_key": "-start_date",
    "page_size": 1,  # 只要最新一筆
}

# NASA Earthdata 認證
def get_earthdata_session():
    """取得已認證的 requests session，處理 NASA Earthdata 的重定向認證流程"""
    session = requests.Session()
    
    # 1. 先嘗試從環境變數讀取
    username = os.getenv('EARTHDATA_USERNAME')
    password = os.getenv('EARTHDATA_PASSWORD')
    
    if username and password:
        print("使用環境變數中的 Earthdata 認證")
    else:
        # 2. 檢查是否有 .netrc 檔案
        netrc_file = Path.home() / '.netrc'
        
        if netrc_file.exists():
            print("找到 .netrc 檔案，使用現有認證")
            # 如果有 .netrc，requests 會自動使用它
        else:
            # 3. 如果都沒有，提示用戶輸入帳號密碼
            print("需要 NASA Earthdata 登入資訊")
            print("請到 https://urs.earthdata.nasa.gov/ 註冊帳號")
            print("或在 .env 檔案中設定 EARTHDATA_USERNAME 和 EARTHDATA_PASSWORD")
            
            username = input("輸入 Earthdata 用戶名: ")
            password = getpass.getpass("輸入 Earthdata 密碼: ")
    
    # 設定認證到 URS (Earthdata 認證系統)
    if username and password:
        session.auth = (username, password)
    
    # 重要：讓 session 自動處理重定向和 cookies
    session.max_redirects = 10
    
    # 設定 User-Agent，某些服務需要
    session.headers.update({
        'User-Agent': 'tempo-aqi-web/1.0 (Python requests)'
    })
    
    # 測試認證是否有效
    test_url = "https://urs.earthdata.nasa.gov/profile"
    try:
        response = session.get(test_url, timeout=30)
        if response.status_code == 200:
            print("✓ Earthdata 認證成功")
        else:
            print(f"⚠ Earthdata 認證可能有問題 (狀態碼: {response.status_code})")
    except Exception as e:
        print(f"⚠ 測試認證時發生錯誤: {e}")
    
    return session

def convert_nc_to_geotiff(nc_file_path, output_dir="../public/tempo/geotiff"):
    """將 NetCDF 檔案轉換為 GeoTIFF"""
    
    print(f"\n開始轉換 NetCDF 到 GeoTIFF...")
    print(f"輸入檔案: {nc_file_path}")
    
    # 創建輸出目錄
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # 先從根層取得座標資訊
        with xr.open_dataset(nc_file_path, engine=NETCDF_ENGINE) as root_ds:
            print(f"根層變數: {list(root_ds.variables.keys())}")

            if 'latitude' in root_ds and 'longitude' in root_ds:
                lat_name, lon_name = 'latitude', 'longitude'
            elif 'lat' in root_ds and 'lon' in root_ds:
                lat_name, lon_name = 'lat', 'lon'
            else:
                print(f"可用座標: {list(root_ds.variables.keys())}")
                raise ValueError("找不到緯度和經度座標")

            lats = root_ds[lat_name].values
            lons = root_ds[lon_name].values

        # 依序嘗試候選的 NO2 變數 (group, variable)
        candidate_vars = [
            ('product', 'vertical_column_troposphere'),
            ('support_data', 'vertical_column_total'),
            (None, 'vertical_column_troposphere'),
            (None, 'vertical_column_total'),
            ('product', 'vertical_column_troposphere_uncertainty'),
            ('support_data', 'fitted_slant_column'),
        ]

        data = None
        for group_name, var_name in candidate_vars:
            try:
                if group_name is None:
                    group_ds = xr.open_dataset(
                        nc_file_path,
                        engine=NETCDF_ENGINE,
                    )
                else:
                    group_ds = xr.open_dataset(
                        nc_file_path,
                        group=group_name,
                        engine=NETCDF_ENGINE,
                    )
            except OSError:
                continue

            if var_name in group_ds.data_vars:
                data = group_ds[var_name].load()
                print(f"使用 NO2 變數: {var_name} (group='{group_name}')")
                group_ds.close()
                break

            group_ds.close()

        if data is None:
            raise ValueError("找不到可用的 NO2 變數，請檢查 NetCDF 檔案內容")

        print(f"數據形狀: {data.shape}")
        print(f"數據維度: {data.dims}")

        # 如果數據有時間維度，取第一個時間點
        if 'time' in data.dims:
            data = data.isel(time=0)
            print("選擇第一個時間點")
        
        # 如果還有其他維度，取第一個
        while len(data.dims) > 2:
            dim_to_remove = [d for d in data.dims if d not in ['latitude', 'longitude', 'lat', 'lon']][0]
            data = data.isel({dim_to_remove: 0})
            print(f"移除維度: {dim_to_remove}")
        
        # 獲取數據數值
        data_values = data.values
        
        # 處理無效值
        data_values = np.where(np.isfinite(data_values), data_values, np.nan)
        
        # 確保維度順序正確 (lat, lon)
        if data.dims[0] == 'longitude' or data.dims[0] == 'lon':
            data_values = data_values.T
            lats, lons = lons, lats
        
        print(f"最終數據形狀: {data_values.shape}")
        print(f"緯度範圍: {np.nanmin(lats):.3f} 到 {np.nanmax(lats):.3f}")
        print(f"經度範圍: {np.nanmin(lons):.3f} 到 {np.nanmax(lons):.3f}")
        
        # 檢查緯度是否遞增（南到北），如果是則需要翻轉
        if len(lats.shape) == 1:  # 1D 緯度陣列
            lat_ascending = np.all(np.diff(lats) > 0)
        else:  # 2D 緯度陣列
            lat_ascending = np.all(np.diff(lats, axis=0) > 0)
        
        print(f"緯度是否遞增 (南→北): {lat_ascending}")
        
        if lat_ascending:
            print("翻轉資料使其符合地圖投影 (北→南)")
            data_values = np.flipud(data_values)
            # 注意：翻轉數據後，不要翻轉座標陣列
            # 因為我們需要保持座標的原始範圍來正確計算邊界
        
        # 計算地理邊界 - 確保 min_lat < max_lat
        min_lon, max_lon = float(np.nanmin(lons)), float(np.nanmax(lons))
        min_lat, max_lat = float(np.nanmin(lats)), float(np.nanmax(lats))
        
        # 如果我們翻轉了數據，需要確保 transform 矩陣正確
        # 對於翻轉的數據，我們需要使用正確的像素高度方向
        height, width = data_values.shape
        
        if lat_ascending:
            # 如果原始數據是南→北遞增，翻轉後應該是北→南
            # 使用負的像素高度來指示數據從北到南
            transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
            print(f"使用翻轉後的變換矩陣 (北→南)")
        else:
            # 原始數據已經是北→南，直接使用
            transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
            print(f"使用原始變換矩陣 (北→南)")
        
        # 設定輸出檔案名稱
        nc_filename = Path(nc_file_path).stem
        geotiff_filename = f"{nc_filename}_NO2.tif"
        geotiff_path = output_path / geotiff_filename
        
        # 寫入 GeoTIFF
        with rasterio.open(
            geotiff_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=1,
            dtype=data_values.dtype,
            crs=CRS.from_epsg(4326),  # WGS84
            transform=transform,
            compress='lzw'
        ) as dst:
            dst.write(data_values, 1)
            
            # 設定 NoData 值
            dst.nodata = np.nan
            
            # 添加描述
            dst.update_tags(
                DESCRIPTION=f'TEMPO NO2 data from {nc_filename}',
                VARIABLE_NAME=candidate_vars
            )
        
        dst.close()
        
        print(f"✓ GeoTIFF 轉換完成: {geotiff_path}")
        return str(geotiff_path)
        
    except Exception as e:
        print(f"轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return None

def create_colored_geotiff(geotiff_file, output_dir="../public/tempo/geotiff"):
    """創建著色的 GeoTIFF 以改善視覺效果"""
    try:
        print("創建著色版本的 GeoTIFF...")
        
        # 讀取原始 GeoTIFF
        with rasterio.open(geotiff_file) as src:
            data = src.read(1)  # 讀取第一個波段
            profile = src.profile.copy()
            
            # 計算統計資訊（忽略 NaN 值）
            valid_data = data[np.isfinite(data)]
            if len(valid_data) == 0:
                print("警告：沒有有效數據")
                return geotiff_file
            
            # 使用更保守的百分位數來避免極值影響
            data_min = np.percentile(valid_data, 1)    # 1% 分位數
            data_max = np.percentile(valid_data, 99)   # 99% 分位數
            data_mean = np.nanmean(valid_data)
            data_std = np.nanstd(valid_data)
            
            # 對於 NO2 數據，我們知道典型範圍是 0 到 5e15 molecules/cm²
            # 如果數據看起來合理，使用固定範圍來保持一致性
            if data_min >= 0 and data_max <= 1e16:  # 合理的 NO2 範圍
                # 使用固定的科學範圍來保持顏色映射的一致性
                scientific_min = 0
                scientific_max = 5e15  # 5×10¹⁵ molecules/cm²
                
                print(f"使用科學標準範圍進行顏色映射:")
                print(f"  標準最小值: {scientific_min:.2e} molecules/cm²")
                print(f"  標準最大值: {scientific_max:.2e} molecules/cm²")
                print(f"  實際數據範圍: {data_min:.2e} - {data_max:.2e}")
                
                data_min, data_max = scientific_min, scientific_max
            else:
                print(f"數據範圍異常，使用百分位數範圍:")
            
            print(f"資料統計:")
            print(f"  顏色映射最小值: {data_min:.6e}")
            print(f"  顏色映射最大值: {data_max:.6e}")
            print(f"  實際平均值: {data_mean:.6e}")
            print(f"  實際標準差: {data_std:.6e}")
            
            # 正規化到 0-255 範圍，保留 0 給無資料
            range_span = data_max - data_min
            if range_span <= 0:
                scaled = np.zeros_like(data, dtype=np.float32)
            else:
                scaled = (data - data_min) / range_span

            normalized = np.where(
                np.isfinite(data),
                np.clip(scaled, 0, 1),
                np.nan
            )

            normalized_data = np.where(
                np.isnan(normalized),
                0,
                (normalized * 255).astype(np.uint8)
            )
            
            # 更新 profile
            profile.update(
                dtype=rasterio.uint8,
                count=1,
                compress='lzw',
                nodata=0
            )
            
            # 創建輸出檔案名稱
            base_name = Path(geotiff_file).stem
            colored_filename = f"{base_name}_colored.tif"
            colored_path = Path(output_dir) / colored_filename
            
            # 寫入著色的 GeoTIFF
            with rasterio.open(colored_path, 'w', **profile) as dst:
                dst.write(normalized_data, 1)
                
                dst.write_colormap(1, _build_color_ramp())

                print("顏色映射: 透明 → 藍 → 綠 → 黃 → 紅，對應濃度由低到高")
            
            print(f"✓ 著色 GeoTIFF 創建完成: {colored_path}")
            return str(colored_path)
            
    except Exception as e:
        print(f"創建著色 GeoTIFF 失敗: {e}")
        import traceback
        traceback.print_exc()
        return geotiff_file  # 返回原始檔案

def generate_tiles(geotiff_file):
    """使用 GDAL 生成 raster tiles"""
    try:
        print("開始生成 raster tiles...")
        print(f"輸入檔案: {geotiff_file}")
        
        # 設置輸出路徑
        base_dir = os.path.dirname(geotiff_file)  # geotiff 目錄
        parent_dir = os.path.dirname(base_dir)    # tempo 目錄
        tiles_dir = os.path.join(parent_dir, 'tiles')
        
        # 步驟 1: 檢查原始 GeoTIFF
        print("步驟 1: 檢查原始 GeoTIFF...")
        
        # 使用 gdalinfo 取得統計資訊
        gdalinfo_cmd = ['gdalinfo', '-stats', geotiff_file]
        result = subprocess.run(gdalinfo_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("資料統計:")
            for line in result.stdout.split('\n'):
                if 'Minimum=' in line or 'Maximum=' in line or 'Mean=' in line:
                    print(f"  {line.strip()}")
        
        # 步驟 2: 創建乾淨的 8-bit GeoTIFF
        print("步驟 2: 創建標準化的 GeoTIFF...")
        clean_tiff = os.path.join(base_dir, 'clean_tempo.tif')
        
        # 使用 gdal_translate 創建標準的 8-bit RGBA GeoTIFF
        translate_cmd = [
            'gdal_translate',
            '-of', 'GTiff',
            '-ot', 'Byte',
            '-scale',  # 自動縮放到 0-255
            '-co', 'COMPRESS=LZW',
            '-co', 'TILED=YES',
            '-co', 'BIGTIFF=NO',
            geotiff_file,
            clean_tiff
        ]
        
        print(f"執行命令: {' '.join(translate_cmd)}")
        result = subprocess.run(translate_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"gdal_translate 失敗:")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return None
        
        print(f"✓ 清理後的 GeoTIFF: {clean_tiff}")
        
        # 步驟 3: 轉換為 RGBA 格式
        print("步驟 3: 轉換為 RGBA 格式...")
        rgba_tiff = os.path.join(base_dir, 'rgba_tempo.tif')
        
        # 使用 gdal_translate 展開顏色表為 RGBA
        rgba_cmd = [
            'gdal_translate',
            '-of', 'GTiff',
            '-expand', 'rgba',
            '-co', 'COMPRESS=LZW',
            '-co', 'TILED=YES',
            geotiff_file,  # 使用原始的著色 GeoTIFF
            rgba_tiff
        ]
        
        print(f"執行命令: {' '.join(rgba_cmd)}")
        result = subprocess.run(rgba_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"RGBA 轉換失敗:")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return None
        
        print(f"✓ RGBA GeoTIFF: {rgba_tiff}")
        
        # 步驟 4: 使用改進的 gdal2tiles 設定
        print("步驟 4: 生成標準 XYZ tiles...")
        
        # 確保輸出目錄存在
        os.makedirs(tiles_dir, exist_ok=True)
        
        cmd = [
            'gdal2tiles.py',
            '--zoom=2-8',
            '--webviewer=leaflet',
            '--processes=2',  # 減少並行處理可能的問題
            '--resampling=average',  # 使用平均重採樣
            '--profile=mercator',  # 明確指定 Web Mercator
            '--xyz',  # 使用 XYZ tile 格式
            rgba_tiff,  # 使用 RGBA 版本
            tiles_dir
        ]
        
        print(f"執行命令: {' '.join(cmd)}")
        
        # 執行命令
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ Tiles 生成成功!")
            
            # 檢查生成的 tiles
            sample_tile = os.path.join(tiles_dir, '4', '2', '10.png')
            if os.path.exists(sample_tile):
                print(f"✓ 樣本 tile 存在: {sample_tile}")
                
                # 檢查 PNG 檔案有效性
                try:
                    from PIL import Image
                    img = Image.open(sample_tile)
                    print(f"✓ 樣本 tile 可以正常開啟: {img.size} {img.mode}")
                except Exception as e:
                    print(f"⚠ 樣本 tile 可能有問題: {e}")
            
            # 清理臨時檔案
            try:
                if os.path.exists(clean_tiff):
                    os.remove(clean_tiff)
                if os.path.exists(rgba_tiff):
                    os.remove(rgba_tiff)
                print(f"清理臨時檔案")
            except Exception as e:
                print(f"無法清理臨時檔案: {e}")
            
            return tiles_dir
        else:
            print("生成 tiles 失敗:")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"生成 tiles 過程中發生錯誤: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_latest_nc_download_url():
    r = requests.get(CMR_URL, params=PARAMS, timeout=30)
    r.raise_for_status()
    data = r.json()

    entry = data["feed"]["entry"][0]

    # 從 links 裡挑出「直接下載 .nc」的連結（rel 含 data#）
    links = entry.get("links", [])
    nc_links = [
        l["href"]
        for l in links
        if l.get("rel", "").endswith("/data#") and l.get("href", "").endswith(".nc")
    ]

    # 通常會有一個 https 的 protected 連結（需要 Earthdata Login）
    download_url = next((u for u in nc_links if u.startswith("https://")), None)

    print("Latest granule title:", entry.get("title"))
    print("Start:", entry.get("time_start"), "End:", entry.get("time_end"))
    print("Download URL:", download_url)
    return download_url, entry.get("title")

def download_nc_file(url, save_dir="../public/tempo/no2", session=None):
    """下載 NetCDF 檔案到指定目錄"""
    
    # 如果沒有提供 session，創建一個新的
    if session is None:
        session = get_earthdata_session()
    
    # 創建目錄如果不存在
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    
    # 從 URL 取得檔案名稱
    parsed_url = urlparse(url)
    filename = Path(parsed_url.path).name
    
    # 完整的檔案路徑
    file_path = save_path / filename
    
    # 檢查檔案是否已經存在
    if file_path.exists():
        print(f"檔案已存在: {filename}")
        return str(file_path)
    
    # 檢查並記錄現有的舊檔案
    existing_files = list(save_path.glob("TEMPO_NO2_*.nc"))
    print(f"目前資料夾中有 {len(existing_files)} 個 TEMPO NO2 檔案")
    
    print(f"開始下載: {filename}")
    print(f"儲存位置: {file_path}")
    
    try:
        print(f"正在連接到: {url}")
        
        # 使用 requests session 進行完整的 OAuth 流程
        # 第一步：訪問原始 URL，讓它重定向到認證頁面
        print("步驟 1: 訪問下載 URL...")
        response1 = session.get(url, allow_redirects=False, timeout=30)
        
        if response1.status_code == 302 or response1.status_code == 301:
            redirect_url = response1.headers.get('Location')
            print(f"步驟 2: 重定向到認證 URL: {redirect_url[:100]}...")
            
            # 第二步：訪問認證 URL
            response2 = session.get(redirect_url, allow_redirects=True, timeout=30)
            
            if response2.status_code == 200:
                print("步驟 3: 認證成功，重新嘗試下載...")
                
                # 第三步：重新嘗試原始 URL
                response = session.get(url, stream=True, timeout=300, allow_redirects=True)
                
                if response.status_code == 200:
                    # 取得檔案大小（如果有提供）
                    total_size = int(response.headers.get('content-length', 0))
                    
                    with open(file_path, 'wb') as f:
                        downloaded = 0
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                
                                # 顯示進度（每 1MB 顯示一次）
                                if downloaded % (1024 * 1024) == 0:
                                    if total_size > 0:
                                        progress = (downloaded / total_size) * 100
                                        print(f"下載進度: {progress:.1f}% ({downloaded / (1024*1024):.1f}MB)")
                                    else:
                                        print(f"已下載: {downloaded / (1024*1024):.1f}MB")
                    
                    print(f"下載完成: {filename}")
                    
                    # 刪除舊的 TEMPO NO2 檔案（除了剛下載的檔案）
                    if existing_files:
                        print(f"\n清理舊檔案...")
                        for old_file in existing_files:
                            if old_file != file_path:  # 確保不刪除剛下載的檔案
                                try:
                                    old_file.unlink()
                                    print(f"已刪除舊檔案: {old_file.name}")
                                except Exception as e:
                                    print(f"刪除舊檔案失敗 {old_file.name}: {e}")
                    
                    return str(file_path)
                else:
                    print(f"下載失敗，狀態碼: {response.status_code}")
            else:
                print(f"認證失敗，狀態碼: {response2.status_code}")
        else:
            # 如果沒有重定向，直接嘗試下載
            print("沒有重定向，直接下載...")
            if response1.status_code == 200:
                total_size = int(response1.headers.get('content-length', 0))
                
                with open(file_path, 'wb') as f:
                    downloaded = 0
                    for chunk in response1.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if downloaded % (1024 * 1024) == 0:
                                if total_size > 0:
                                    progress = (downloaded / total_size) * 100
                                    print(f"下載進度: {progress:.1f}% ({downloaded / (1024*1024):.1f}MB)")
                                else:
                                    print(f"已下載: {downloaded / (1024*1024):.1f}MB")
                
                print(f"下載完成: {filename}")
                
                # 刪除舊的 TEMPO NO2 檔案（除了剛下載的檔案）
                if existing_files:
                    print(f"\n清理舊檔案...")
                    for old_file in existing_files:
                        if old_file != file_path:  # 確保不刪除剛下載的檔案
                            try:
                                old_file.unlink()
                                print(f"已刪除舊檔案: {old_file.name}")
                            except Exception as e:
                                print(f"刪除舊檔案失敗 {old_file.name}: {e}")
                
                return str(file_path)
        
        return None
        
    except Exception as e:
        print(f"下載失敗: {e}")
        # 如果下載失敗，刪除部分下載的檔案
        if file_path.exists():
            file_path.unlink()
        return None

if __name__ == "__main__":
    try:
        # 取得最新檔案的下載連結
        download_url, title = get_latest_nc_download_url()
        
        if download_url:
            print("\n" + "="*50)
            print("開始下載 TEMPO NO2 檔案...")
            
            # 取得認證的 session
            session = get_earthdata_session()
            
            # 下載檔案
            downloaded_file = download_nc_file(download_url, session=session)
            
            if downloaded_file:
                print(f"\n成功下載檔案到: {downloaded_file}")
                
                # 轉換為 GeoTIFF
                print("\n" + "="*50)
                print("開始轉換為 GeoTIFF...")
                geotiff_file = convert_nc_to_geotiff(downloaded_file)
                
                if geotiff_file:
                    print(f"成功轉換為 GeoTIFF: {geotiff_file}")
                    
                    # 創建著色版本
                    print("\n" + "="*50)
                    print("創建著色版本...")
                    colored_geotiff = create_colored_geotiff(geotiff_file)
                    
                    # 生成 raster tiles (使用著色版本)
                    print("\n" + "="*50)
                    print("開始生成 raster tiles...")
                    tiles_dir = generate_tiles(colored_geotiff)
                    
                    if tiles_dir:
                        print(f"成功生成 tiles: {tiles_dir}")
                        print("\n" + "="*50)
                        print("處理完成！")
                        print(f"NetCDF 檔案: {downloaded_file}")
                        print(f"原始 GeoTIFF: {geotiff_file}")
                        print(f"著色 GeoTIFF: {colored_geotiff}")
                        print(f"Tiles 目錄: {tiles_dir}")
                    else:
                        print("生成 tiles 失敗")
                else:
                    print("轉換 GeoTIFF 失敗")
            else:
                print("\n下載失敗")
        else:
            print("無法取得下載連結")
            
    except Exception as e:
        print(f"發生錯誤: {e}")
        import traceback
        traceback.print_exc()
