import urllib.request
import urllib.parse
import json

keyword = urllib.parse.quote("توحيد")
target_url = "https://dorar.net/dorar_api.json?skey=" + keyword
proxy_url = "https://api.allorigins.win/get?url=" + urllib.parse.quote(target_url)

req = urllib.request.Request(proxy_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        data = response.read().decode('utf-8')
        json_data = json.loads(data)
        if 'contents' in json_data:
            print("Proxy success. Contents length:", len(json_data['contents']))
        else:
            print("Proxy response missing 'contents':", json_data)
except Exception as e:
    print("Error:", e)
