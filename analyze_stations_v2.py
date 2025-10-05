#!/usr/bin/env python3
import json
import os
from collections import defaultdict, Counter

def extract_city_name(station_name):
    """更智能地提取城市名稱"""
    if not station_name:
        return 'Unknown'
    
    # 常見的美國主要城市名稱模式
    major_cities = {
        'los angeles', 'la', 'new york', 'chicago', 'houston', 'phoenix', 'philadelphia', 
        'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
        'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis', 'seattle',
        'denver', 'washington', 'boston', 'el paso', 'detroit', 'nashville', 'portland',
        'memphis', 'oklahoma city', 'las vegas', 'louisville', 'baltimore', 'milwaukee',
        'albuquerque', 'tucson', 'fresno', 'sacramento', 'kansas city', 'mesa', 'virginia beach',
        'atlanta', 'colorado springs', 'omaha', 'raleigh', 'miami', 'long beach', 'minneapolis',
        'oakland', 'tulsa', 'arlington', 'new orleans', 'wichita', 'cleveland', 'tampa',
        'bakersfield', 'aurora', 'anaheim', 'honolulu', 'santa ana', 'corpus christi',
        'riverside', 'lexington', 'stockton', 'st. louis', 'saint paul', 'cincinnati',
        'pittsburgh', 'greensboro', 'lincoln', 'plano', 'anchorage', 'orlando', 'irvine',
        'newark', 'durham', 'chula vista', 'toledo', 'jersey city', 'chandler', 'madison',
        'lubbock', 'buffalo', 'gilbert', 'glendale', 'reno', 'hialeah', 'garland',
        'chesapeake', 'scottsdale', 'north las vegas', 'baton rouge', 'irving', 'fremont'
    }
    
    name_lower = station_name.lower()
    
    # 首先檢查是否包含主要城市名稱
    for city in major_cities:
        if city in name_lower:
            return city.title()
    
    # 如果沒有找到主要城市，使用基本規則
    parts = station_name.split(' ')
    
    # 過濾掉常見的非城市詞彙
    non_city_words = {
        'fire', 'station', 'monitor', 'site', 'near', 'at', 'by', 'airport', 'school',
        'hospital', 'park', 'center', 'downtown', 'east', 'west', 'north', 'south',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'no', 'no.', '#', 'street', 'ave', 'rd',
        'road', 'avenue', 'blvd', 'boulevard', 'lane', 'ln', 'dr', 'drive', 'ct', 'court'
    }
    
    # 尋找可能的城市名稱
    for i in range(len(parts)):
        for j in range(i+1, min(i+3, len(parts)+1)):  # 最多取兩個詞
            candidate = ' '.join(parts[i:j])
            if (len(candidate) > 3 and 
                candidate.lower() not in non_city_words and
                not candidate.isdigit() and
                not any(char.isdigit() for char in candidate)):
                return candidate
    
    # 如果還是找不到，返回前兩個詞（如果存在）
    if len(parts) >= 2:
        return ' '.join(parts[:2])
    elif len(parts) == 1:
        return parts[0]
    else:
        return 'Unknown'

def analyze_openaq_stations():
    # 讀取 GeoJSON 檔案
    file_path = '/Users/jylin/Documents/研究所/2025_NASA_Hackthon/tempo-aqi-web/public/data/openaq-us-stations.geojson'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 我們要找的六個主要污染物 sensors
    target_sensors = {'co', 'no2', 'o3', 'pm10', 'pm25', 'so2'}
    
    # 分析站點
    city_stations = defaultdict(list)
    complete_stations = []
    
    for feature in data['features']:
        props = feature['properties']
        
        # 提取城市資訊
        name = props.get('name', '')
        city = extract_city_name(name)
        
        # 檢查 sensors
        sensors = props.get('sensors', [])
        sensor_types = set()
        for sensor in sensors:
            param_name = sensor.get('parameter_name', '').lower()
            if param_name in target_sensors:
                sensor_types.add(param_name)
        
        station_info = {
            'id': props.get('id'),
            'name': name,
            'city': city,
            'provider': props.get('provider', ''),
            'timezone': props.get('timezone', ''),
            'sensor_count': len(sensor_types),
            'sensors': list(sensor_types),
            'coordinates': feature['geometry']['coordinates']
        }
        
        city_stations[city].append(station_info)
        
        # 如果有完整的六個 sensors
        if len(sensor_types) == 6 and sensor_types == target_sensors:
            complete_stations.append(station_info)
    
    # 分析結果
    print("=== OpenAQ 站點分析結果 ===\n")
    
    # 找出站點數量最多的城市
    city_counts = [(city, len(stations)) for city, stations in city_stations.items()]
    city_counts.sort(key=lambda x: x[1], reverse=True)
    
    print("前15個站點數量最多的城市：")
    for i, (city, count) in enumerate(city_counts[:15], 1):
        print(f"{i:2d}. {city:25} - {count:3d} 個站點")
    
    print(f"\n總共找到 {len(complete_stations)} 個有完整六個 sensors 的站點\n")
    
    # 分析有完整六個 sensors 的站點在哪些城市
    complete_by_city = defaultdict(list)
    for station in complete_stations:
        complete_by_city[station['city']].append(station)
    
    print("有完整六個 sensors 的站點分布：")
    complete_city_counts = [(city, len(stations)) for city, stations in complete_by_city.items()]
    complete_city_counts.sort(key=lambda x: x[1], reverse=True)
    
    for i, (city, count) in enumerate(complete_city_counts, 1):
        print(f"{i:2d}. {city:25} - {count:2d} 個完整站點")
    
    print("\n=== 十個重要城市中的完整站點詳細資訊 ===\n")
    
    # 選擇重要城市（優先選擇有完整站點的主要城市）
    important_cities = []
    
    # 優先加入有完整站點的城市
    for city, complete_count in complete_city_counts:
        if city != 'Unknown':  # 排除 Unknown
            total_count = len(city_stations[city])
            important_cities.append((city, total_count, complete_count))
    
    # 按完整站點數排序，然後按總站點數排序
    important_cities.sort(key=lambda x: (x[2], x[1]), reverse=True)
    
    # 顯示前10個重要城市的完整站點
    count = 0
    for city, total_count, complete_count in important_cities[:10]:
        count += 1
        print(f"{count}. {city} (總站點: {total_count}, 完整站點: {complete_count})")
        
        # 顯示該城市的完整站點
        city_complete_stations = complete_by_city[city]
        for i, station in enumerate(city_complete_stations, 1):
            print(f"   {i}. {station['name']}")
            print(f"      ID: {station['id']}, Provider: {station['provider']}")
            print(f"      座標: {station['coordinates']}")
            print(f"      Sensors: {', '.join(sorted(station['sensors']))}")
            print()

if __name__ == '__main__':
    analyze_openaq_stations()