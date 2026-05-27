import urllib.request
import urllib.parse

target_url = "https://dorar.net/dorar_api.json?skey=" + urllib.parse.quote("توحيد")
proxy_url = "https://api.codetabs.com/v1/proxy?quest=" + target_url

req = urllib.request.Request(proxy_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        data = response.read().decode('utf-8')
        print("Proxy success. Data preview:", data[:100])
except Exception as e:
    print("Error:", e)
