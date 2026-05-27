import urllib.request
import urllib.parse
import ssl

def search(query):
    url = "https://dorar.net/dorar_api.json?skey=" + urllib.parse.quote(query)
    req = urllib.request.Request(
        url, 
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'ar,en-US;q=0.7,en;q=0.3',
            'Referer': 'https://dorar.net/',
        }
    )
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=10, context=context) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        return f"Error: {e}"

print(search("توحيد")[:200])
