import urllib.request
import urllib.parse
import ssl

query = "فمن كانت هجرته"
url = "https://dorar.net/dorar_api.json?skey=" + urllib.parse.quote(query)
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
)
try:
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=10, context=context) as response:
        print(response.read().decode('utf-8')[:100])
except Exception as e:
    print(f"Error: {e}")
