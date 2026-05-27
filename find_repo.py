import urllib.request
import json
import ssl

context = ssl._create_unverified_context()
req = urllib.request.Request("https://api.github.com/repos/mhashim6/Open-Hadith-Data/contents/Sahih_Al-Bukhari", headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=context) as response:
        data = json.loads(response.read().decode('utf-8'))
        for item in data:
            print(item['name'])
except Exception as e:
    print("Error:", e)
