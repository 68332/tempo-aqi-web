import json
import os
import argparse
from typing import Any, Dict, List, Tuple
import requests

API_URL = "https://tolnet.larc.nasa.gov/api/instruments/groups"

# Set default bounds to North America: (lon_min, lon_max, lat_min, lat_max)
DEFAULT_BOUNDS = (-170.0, -50.0, 5.0, 85.0)

# Setting the output file path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
OUTPUT_DIR = os.path.join(project_root, "public", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "TOLnet-us-stations.geojson")

# Fetch instrument groups from the API
def fetch_instrument_groups(url: str = API_URL, timeout: int = 40) -> List[Dict[str, Any]]:
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict) and "instruments" in data:
        return data["instruments"]
    if isinstance(data, list):
        return data
    raise RuntimeError("Unexpected API response structure.")

# Parse bounds from string input
def parse_bounds(b: str) -> Tuple[float, float, float, float]:
    try:
        lon_min, lon_max, lat_min, lat_max = [float(x.strip()) for x in b.split(",")]
        return lon_min, lon_max, lat_min, lat_max
    except Exception:
        raise argparse.ArgumentTypeError("bounds 格式需為 'lon_min,lon_max,lat_min,lat_max'")

# Check if a point is within the given bounding box
def in_bounds(lon: float, lat: float, bbox: Tuple[float, float, float, float]) -> bool:
    lon_min, lon_max, lat_min, lat_max = bbox
    return lon_min <= lon <= lon_max and lat_min <= lat <= lat_max

# Convert rows of instrument data to GeoJSON FeatureCollection
def to_geojson(rows: List[Dict[str, Any]],
               bbox: Tuple[float, float, float, float] = DEFAULT_BOUNDS,
               keep_all: bool = False) -> Dict[str, Any]:
    features = []
    seen = set()
    for r in rows:
        name = r.get("instrument_group_name") or r.get("name") or f"id={r.get('id')}"
        lat = r.get("home_latitude")
        lon = r.get("home_longitude")
        if lat is None or lon is None:
            continue
        try:
            lat = float(lat); lon = float(lon)
        except Exception:
            continue
        if not keep_all and not in_bounds(lon, lat, bbox):
            continue
        key = (name, round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        props = {
            "id": r.get("id"),
            "name": name,
            "folder_name": r.get("folder_name"),
            "description": r.get("description"),
            "current_pi": r.get("current_pi"),
            "doi": r.get("doi"),
            "citation_url": r.get("citation_url"),
            "home_location": r.get("home_location"),
        }
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Point", "coordinates": [lon, lat]}
        })
    return {"type": "FeatureCollection", "features": features}

def main():
    ap = argparse.ArgumentParser(description="Fetch TOLNet instrument groups and export as GeoJSON.")
    ap.add_argument("--bounds", type=parse_bounds,
                    help="自訂邊界 'lon_min,lon_max,lat_min,lat_max'；不提供則用北美預設")
    ap.add_argument("--all", action="store_true",
                    help="不套邊界，輸出所有站點")
    ap.add_argument("--pretty", action="store_true",
                    help="美化縮排輸出")
    args = ap.parse_args()

    bbox = args.bounds if args.bounds else DEFAULT_BOUNDS

    print("→ 下載 instruments/groups …")
    rows = fetch_instrument_groups()

    print(f"→ 轉為 GeoJSON（{'全部' if args.all else '北美範圍'}） …")
    fc = to_geojson(rows, bbox=bbox, keep_all=args.all)

    os.makedirs(OUTPUT_DIR, exist_ok=True)  # 確保目錄存在
    kw = {"ensure_ascii": False}
    if args.pretty:
        kw["indent"] = 2

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(fc, f, **kw)

    print(f"✔ 完成：{OUTPUT_FILE}（features: {len(fc['features'])}）")

if __name__ == "__main__":
    main()
