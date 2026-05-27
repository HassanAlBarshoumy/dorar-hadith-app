import urllib.request
import json
import ssl

context = ssl._create_unverified_context()

folders = [
    "Sahih_Al-Bukhari",
    "Sahih_Muslim",
    "Sunan_Abu-Dawud",
    "Sunan_Al-Tirmidhi",
    "Sunan_Al-Nasai",
    "Sunan_Ibn-Maja",
    "Sunan_Al-Darimi",
    "Maliks_Muwataa",
    "Musnad_Ahmad_Ibn-Hanbal"
]

for folder in folders:
    req = urllib.request.Request(f"https://api.github.com/repos/mhashim6/Open-Hadith-Data/contents/{folder}", headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=context) as response:
            data = json.loads(response.read().decode('utf-8'))
            for item in data:
                if item['name'].endswith('.utf8.csv') and 'mushakkala' not in item['name']:
                    print(f"{folder}: {item['name']}")
    except Exception as e:
        print("Error fetching", folder, e)
