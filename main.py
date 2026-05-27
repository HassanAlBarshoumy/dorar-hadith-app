import webview
import urllib.request
import urllib.parse
import os
import sys

# For PyInstaller to find the data files
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

class Api:
    def search(self, query):
        url = "https://dorar.net/dorar_api.json?skey=" + urllib.parse.quote(query)
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read().decode('utf-8')
        except Exception as e:
            return None

    def get_settings(self):
        settings_path = os.path.join(os.getenv('APPDATA'), 'dorar_settings.json')
        if os.path.exists(settings_path):
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception:
                pass
        return None

    def save_settings(self, settings_str):
        settings_path = os.path.join(os.getenv('APPDATA'), 'dorar_settings.json')
        try:
            with open(settings_path, 'w', encoding='utf-8') as f:
                f.write(settings_str)
            return True
        except Exception:
            return False

if __name__ == '__main__':
    api = Api()
    html_file = resource_path('index.html')
    webview.create_window('تطبيق الموسوعة الحديثية', 'file://' + html_file, js_api=api, width=900, height=700)
    webview.start()
