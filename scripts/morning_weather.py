#!/usr/bin/env python3
"""
Morning Weather Report Script
毎朝の天気レポートを生成してDiscordに送信
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime

# 設定
LOCATION_FILE = "/home/node/.openclaw/workspace/memory/current-location.txt"
SCHEDULE_FILE = "/home/node/.openclaw/workspace/memory/schedule.md"

def get_location():
    try:
        with open(LOCATION_FILE, "r") as f:
            content = f.read().strip()
            for line in content.split("\n"):
                if line and not line.startswith("#"):
                    loc = line
                    # 簡易マッピング（英語表記を日本語に）
                    if "Fukuchiyama" in loc or "Fukuchiyama" in loc.title():
                        return "京都府福知山市"
                    if "Kyoto" in loc or "Kyoto Prefecture" in loc:
                        return "京都府福知山市"
                    return loc
    except FileNotFoundError:
        pass
    return "京都府福知山市"

# 英語天気→日本語変換
WEATHER_DESC_JA = {
    "Sunny": "晴れ",
    "Clear": "晴れ",
    "Partly cloudy": "晴れ時々曇り",
    "Cloudy": "曇り",
    "Overcast": "厚い曇り",
    "Mist": "霧",
    "Fog": "霧",
    "Light rain": "小雨",
    "Moderate rain": "雨",
    "Heavy rain": "大雨",
    "Patchy rain nearby": "所により雨",
    "Patchy light rain": "所により小雨",
    "Light drizzle": "霧雨",
    "Thundery outbreaks": "雷雨",
    "Thunderstorm": "雷雨",
    "Light snow": "小雪",
    "Moderate snow": "雪",
    "Heavy snow": "大雪",
    "Patchy snow nearby": "所により雪",
    "Blizzard": "吹雪",
    "Freezing fog": "凍霧",
    "Ice pellets": "霰",
    "Hail": "ひょう",
}

# 風向16方位→日本語
WIND_DIR_JA = {
    "N": "北", "NNE": "北北東", "NE": "北東", "ENE": "東北東",
    "E": "東", "ESE": "東南東", "SE": "南東", "SSE": "南南東",
    "S": "南", "SSW": "南南西", "SW": "南西", "WSW": "西南西",
    "W": "西", "WNW": "西北西", "NW": "北西", "NNW": "北北西",
}

def get_weather(location):
    url = f"https://wttr.in/{urllib.parse.quote(location)}?format=j1"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            # 新しいwttr.inのレスポンス形式対応（dataキーでラップされている）
            if "data" in data:
                return data["data"]
            return data
    except Exception as e:
        print(f"Error fetching weather: {e}")
        return None

def get_schedule():
    try:
        with open(SCHEDULE_FILE, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return None

def kmh_to_ms(kmh):
    try:
        return round(float(kmh) / 3.6, 1)
    except Exception:
        return 0.0

def weather_code_to_emoji(code):
    try:
        code = int(code)
    except Exception:
        return "🌤️"
    if code == 113:
        return "☀️"
    elif code == 116:
        return "⛅"
    elif code == 119:
        return "☁️"
    elif code == 122:
        return "🌥️"
    elif code in [176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 353, 356, 359]:
        return "🌧️"
    elif code in [179, 182, 185, 227, 230, 281, 284, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377]:
        return "🌨️"
    elif code in [200, 386, 389, 392, 395]:
        return "⛈️"
    elif code in [143, 248, 260]:
        return "🌫️"
    else:
        return "🌤️"

def uv_category(uv):
    # WHO基準（簡略）
    try:
        uv = float(uv)
    except Exception:
        return "不明"
    if uv <= 2:
        return "低い"
    if 3 <= uv <= 5:
        return "中等度"
    if 6 <= uv <= 7:
        return "高い"
    if 8 <= uv <= 10:
        return "非常に高い"
    return "極端"

def chance_val(val):
    try:
        return int(val)
    except Exception:
        try:
            return int(float(val))
        except Exception:
            return 0

def generate_report():
    location = get_location()
    weather_data = get_weather(location)

    if not weather_data:
        return "⚠️ 天気データの取得に失敗しました"

    now = datetime.now()
    current = weather_data.get("current_condition", [{}])[0]
    today = weather_data.get("weather", [{}])[0]
    astronomy = today.get("astronomy", [{}])[0]

    # 現在の天気
    temp_c = current.get("temp_C", "?")
    feels_like = current.get("FeelsLikeC", "?")
    humidity = current.get("humidity", "?")
    wind_kmh = current.get("windspeedKmph", "0")
    wind_ms = kmh_to_ms(wind_kmh)
    wind_dir = current.get("winddir16Point", "?")
    weather_code = current.get("weatherCode", "113")
    weather_emoji = weather_code_to_emoji(weather_code)
    weather_desc_en = current.get("weatherDesc", [{}])[0].get("value", "?")
    weather_desc = WEATHER_DESC_JA.get(weather_desc_en, weather_desc_en)
    wind_dir_ja = WIND_DIR_JA.get(wind_dir, wind_dir)
    uv_now = current.get("uvIndex", None)

    # 今日の予報
    max_temp = today.get("maxtempC", "?")
    min_temp = today.get("mintempC", "?")
    sunrise = astronomy.get("sunrise", "?")
    sunset = astronomy.get("sunset", "?")

    # 時間帯別（朝・昼・夕）
    hourly = today.get("hourly", [])
    morning = hourly[2] if len(hourly) > 2 else {}
    noon = hourly[4] if len(hourly) > 4 else {}
    evening = hourly[6] if len(hourly) > 6 else {}

    def get_hourly_info(h):
        temp = h.get("tempC", "?")
        rain_chance = chance_val(h.get("chanceofrain", 0))
        snow_chance = chance_val(h.get("chanceofsnow", 0))
        thunder_chance = chance_val(h.get("chanceofthunder", 0))
        fog_chance = chance_val(h.get("chanceoffog", 0))
        code = h.get("weatherCode", "113")
        emoji = weather_code_to_emoji(code)
        return {
            "temp": temp,
            "rain": rain_chance,
            "snow": snow_chance,
            "thunder": thunder_chance,
            "fog": fog_chance,
            "emoji": emoji
        }

    m = get_hourly_info(morning)
    n = get_hourly_info(noon)
    e = get_hourly_info(evening)

    # 服装提案
    try:
        min_temp_int = int(min_temp)
    except Exception:
        min_temp_int = 10
    clothing = []
    if min_temp_int <= 5:
        clothing.append("コート必須（朝晩は冷え込み）")
    elif min_temp_int <= 10:
        clothing.append("上着が必要")
    else:
        clothing.append("軽装でOK")

    if n["rain"] >= 50:
        clothing.append("傘を持って（雨の可能性高）")
    elif n["rain"] >= 30:
        clothing.append("折り畳み傘があると安心")

    # 注意事項（ある時だけ表示）
    notes = []
    # 昼の雨
    if n["rain"] >= 50:
        notes.append("昼は雨の可能性が高いです（降水 >= 50%）。")
    elif n["rain"] >= 30:
        notes.append("昼に降る可能性があります（降水 >= 30%）。")
    # 雪・雷・霧・霜・強風など: 閾値10%
    for label, v in [("雪", max(m["snow"], n["snow"], e["snow"])),
                     ("雷", max(m["thunder"], n["thunder"], e["thunder"])),
                     ("霧", max(m["fog"], n["fog"], e["fog"]))]:
        if v >= 10:
            notes.append(f"{label}の可能性があります（{v}%）。")

    # UV表示
    uv_text = "取得不可"
    uv_cat = "不明"
    try:
        if uv_now is not None:
            uv_text = str(uv_now)
            uv_cat = uv_category(uv_now)
    except Exception:
        pass

    # レポート生成（中間量）
    report_lines = []
    report_lines.append(f"🌤️ 朝の天気レポート（{now.strftime('%m/%d %H:%M JST')}）")
    report_lines.append(f"📍 {location}")
    report_lines.append("")
    # 時刻表記を24時間に正規化する
    def normalize_time(t):
        if not t:
            return t
        t = t.strip()
        try:
            if 'AM' in t or 'PM' in t:
                dt = datetime.strptime(t, '%I:%M %p')
                return dt.strftime('%H:%M')
            # すでに 06:11 のような形式の場合
            return t
        except Exception:
            return t

    sunrise_h = normalize_time(sunrise)
    sunset_h = normalize_time(sunset)

    report_lines.append(f"【現在】 {weather_emoji} {weather_desc}  {temp_c}℃（体感 {feels_like}℃） | 湿度 {humidity}% | 風 {wind_dir_ja} {wind_ms} m/s")
    report_lines.append("")
    report_lines.append(f"【今日】 最高 {max_temp}℃ / 最低 {min_temp}℃  | 日の出 {sunrise_h} / 日の入 {sunset_h}  | UV {uv_text}（{uv_cat}）")
    report_lines.append("")
    report_lines.append(f"【時間帯】 朝(06:00) {m['emoji']} {m['temp']}℃ / 降水{m['rain']}%  | 昼(12:00) {n['emoji']} {n['temp']}℃ / 降水{n['rain']}%  | 夕(18:00) {e['emoji']} {e['temp']}℃ / 降水{e['rain']}%")
    report_lines.append("")
    if notes:
        report_lines.append("【注意】")
        for s in notes:
            report_lines.append(f"- {s}")
        report_lines.append("")
    report_lines.append(f"【服装】 {' / '.join(clothing)}")

    schedule = get_schedule()
    if schedule:
        report_lines.append("")
        report_lines.append("【予定】")
        report_lines.append(schedule)

    return "\n".join(report_lines)

if __name__ == "__main__":
    print(generate_report())
