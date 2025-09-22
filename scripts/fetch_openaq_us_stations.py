import requests
import json
import os

API_URL = "https://api.openaq.org/v3/locations"
API_KEY = "f842213920405091f23318ca1a7880636ac843b7cb81f8e3985c41b17deb19f2"  # 你的 API Key

# 獲取專案根目錄的 data 資料夾路徑
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
data_dir = os.path.join(project_root, "public", "data")
OUTPUT_FILE = os.path.join(data_dir, "openaq-us-stations.geojson")

def fetch_us_stations():
    page = 1
    limit = 1000
    features = []

    while True:
        print(f"Fetching page {page}...")
        resp = requests.get(
            API_URL,
            headers={"x-api-key": API_KEY},
            params={"countries_id": 155, "limit": limit, "page": page}
        )
        if resp.status_code != 200:
            raise Exception(f"API error: {resp.status_code} {resp.text}")

        data = resp.json()
        results = data.get("results", [])

        if not results:
            break

        for station in results:
            coords = station.get("coordinates")
            if coords:
                # 提取 sensors 資訊
                sensors = []
                for sensor in station.get("sensors", []):
                    parameter = sensor.get("parameter", {})
                    sensors.append({
                        "id": sensor.get("id"),
                        "name": sensor.get("name"),
                        "parameter_id": parameter.get("id"),
                        "parameter_name": parameter.get("name"),
                        "parameter_units": parameter.get("units"),
                        "parameter_display_name": parameter.get("displayName")
                    })

                features.append({
                    "type": "Feature",
                    "properties": {
                        "id": station["id"],
                        "name": station["name"],
                        "provider": station.get("provider", {}).get("name"),
                        "provider_id": station.get("provider", {}).get("id"),
                        "timezone": station.get("timezone"),
                        "country": station.get("country", {}).get("name"),
                        "country_id": station.get("country", {}).get("id"),
                        "country_code": station.get("country", {}).get("code"),
                        "owner": station.get("owner", {}).get("name"),
                        "owner_id": station.get("owner", {}).get("id"),
                        "is_mobile": station.get("isMobile", False),
                        "is_monitor": station.get("isMonitor", False),
                        "sensors": sensors,
                        "sensor_count": len(sensors),
                        "datetime_first": station.get("datetimeFirst"),
                        "datetime_last": station.get("datetimeLast")
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            coords["longitude"],
                            coords["latitude"]
                        ]
                    }
                })

        # 如果少於 limit，表示到最後一頁
        if len(results) < limit:
            break

        page += 1

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # 確保 data 資料夾存在
    os.makedirs(data_dir, exist_ok=True)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(geojson, f, indent=2)

    print(f"Saved {len(features)} stations to {OUTPUT_FILE}")


if __name__ == "__main__":
    fetch_us_stations()