import re
import time
import json
import os
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = "https://data.hetzner.pandonia-global-network.org/"
ROOT = BASE

session = requests.Session()
session.headers.update({"User-Agent": "pandora-l2-geojson/1.0"})
TIMEOUT = 30

# Setting the output file path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
data_dir = os.path.join(project_root, "public", "data")
OUTPUT_FILE = os.path.join(data_dir, "pandora-us-stations.geojson")

# Regular expressions to extract latitude and longitude
LAT_PATS = [
    re.compile(r"(?i)\blat(?:itude)?\s*[:=]\s*([+-]?\d+(?:\.\d+)?)"),
]
LON_PATS = [
    re.compile(r"(?i)\blon(?:g(?:itude)?)?\s*[:=]\s*([+-]?\d+(?:\.\d+)?)"),
]
PAIR_PATS = [
    re.compile(r"(?i)location[^0-9+-]*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)"),
    re.compile(r"(?i)latitude[^0-9+-]*([+-]?\d+(?:\.\d+)?).{0,40}?longitude[^0-9+-]*([+-]?\d+(?:\.\d+)?)"),
]

# Fetch and parse HTML from a URL
def get_soup(url):
    r = session.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

# Get list of directories from a URL
def list_dirs(url):
    soup = get_soup(url)
    dirs = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href in ("../", "./"):
            continue
        if href.endswith("/"):
            dirs.append(urljoin(url, href))    
    return dirs

# Get list of files with a specific suffix from a URL
def list_files(url, suffix=".txt"):
    soup = get_soup(url)
    files = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.endswith(suffix):
            files.append(urljoin(url, href))
    return files

# Fetch the beginning of a text file (up to max_bytes)
def fetch_text_head(url, max_bytes=100_000):
    r = session.get(url, timeout=TIMEOUT, stream=True)
    r.raise_for_status()
    data = r.raw.read(max_bytes, decode_content=True)
    try:
        return data.decode("utf-8", errors="ignore")
    except:
        return data.decode("latin-1", errors="ignore")

# Parse latitude and longitude from text
def parse_latlon(text):
    for pat in PAIR_PATS:
        m = pat.search(text)
        if m:
            return float(m.group(1)), float(m.group(2)), "PAIR"
    lat = lon = None
    for pat in LAT_PATS:
        m = pat.search(text)
        if m:
            lat = float(m.group(1)); break
    for pat in LON_PATS:
        m = pat.search(text)
        if m:
            lon = float(m.group(1)); break
    if lat is not None and lon is not None:
        return lat, lon, "SINGLE_FIELDS"
    header = "\n".join(text.splitlines()[:200])
    m1 = re.search(r"(?i)Latitude[^0-9+-]*([+-]?\d+(?:\.\d+)?)", header)
    m2 = re.search(r"(?i)Longitude[^0-9+-]*([+-]?\d+(?:\.\d+)?)", header)
    if m1 and m2:
        return float(m1.group(1)), float(m2.group(1)), "HEADER_FIELDS"
    return None, None, "NOT_FOUND"

# Output name 
def station_name_from_url(u):
    return u.strip("/").split("/")[-1]

# Output instrument name
def instrument_name_from_url(u):
    return u.strip("/").split("/")[-1]

# Check if coordinates are in North America
def is_north_america(lat, lon):
    return 5 <= lat <= 83 and -170 <= lon <= -50

def main():
    # List all station directories
    station_dirs = list_dirs(ROOT)

    # Iterate over stations and their Pandora instruments
    features = []
    skipped = []
    for sdir in sorted(station_dirs):
        station = station_name_from_url(sdir)
        try:
            subdirs = list_dirs(sdir)
            pandora_dirs = [d for d in subdirs if re.search(r"/Pandora\d+(?:s\d+)?/$", d)]
            if not pandora_dirs:
                skipped.append((station, "", "NO_PANDORA_DIR"))
                continue

            for pdir in sorted(pandora_dirs):
                l2_dir = urljoin(pdir, "L2/")
                try:
                    l2_files = list_files(l2_dir, suffix=".txt")
                except requests.HTTPError:
                    skipped.append((station, instrument_name_from_url(pdir), "NO_L2_DIR"))
                    continue

                if not l2_files:
                    skipped.append((station, instrument_name_from_url(pdir), "NO_TXT_IN_L2"))
                    continue

                first_txt = sorted(l2_files)[0]
                head = fetch_text_head(first_txt)
                lat, lon, how = parse_latlon(head)

                # Validate coordinates
                if lat is None or lon is None:
                    skipped.append((station, instrument_name_from_url(pdir), "NOT_FOUND"))
                    continue
                
                # Check if in North America
                if not is_north_america(lat, lon):
                    skipped.append((station, instrument_name_from_url(pdir), "OUTSIDE_NA"))
                    continue

                feat = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(lon), float(lat)]  # GeoJSON: [lon, lat]
                    },
                    "properties": {
                        "station": station,
                        "instrument": instrument_name_from_url(pdir),
                    }
                }
                features.append(feat)
                time.sleep(0.15)  # 禮貌性延遲

        except requests.HTTPError as e:
            skipped.append((station, "", f"HTTP_ERROR:{e.response.status_code}"))
        except Exception as e:
            skipped.append((station, "", f"ERROR:{e}"))

    geojson_obj = {
        "type": "FeatureCollection",
        "features": features
    }

    # Output GeoJSON file
    OUT_GEOJSON = OUTPUT_FILE
    with open(OUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson_obj, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
