import webview
import urllib.request
import urllib.parse
import os
import sys
import sqlite3
import json
from datetime import datetime

# For PyInstaller to find the data files
def get_db_path():
    app_data_dir = os.getenv('APPDATA')
    if not app_data_dir:
        app_data_dir = os.path.expanduser('~')
    dorar_dir = os.path.join(app_data_dir, 'DorarHadithApp')
    if not os.path.exists(dorar_dir):
        os.makedirs(dorar_dir)
    return os.path.join(dorar_dir, 'dorar_database.db')

def init_db():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Cache Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS search_cache (
            query TEXT PRIMARY KEY,
            results_json TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Local Hadith Table (For open source database integration later)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS local_hadith (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book TEXT,
            chapter TEXT,
            narrator TEXT,
            text_ar TEXT,
            text_ar_clean TEXT,
            authenticity TEXT
        )
    ''')
    conn.commit()
    conn.close()

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

class Api:
    def search(self, query, page=1):
        import ssl
        context = ssl._create_unverified_context()
        
        target_url = f"https://dorar.net/dorar_api.json?skey={urllib.parse.quote(query)}&page={page}"
        req = urllib.request.Request(
            target_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=8, context=context) as response:
                return response.read().decode('utf-8')
        except Exception as e1:
            # Fallback to allorigins proxy if Cloudflare blocks or network fails
            try:
                import json
                proxy_url = "https://api.allorigins.win/get?url=" + urllib.parse.quote(target_url)
                proxy_req = urllib.request.Request(
                    proxy_url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(proxy_req, timeout=10, context=context) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    if data and 'contents' in data:
                        return data['contents']
                    return None
            except Exception as e2:
                log_path = os.path.join(os.getenv('APPDATA'), 'error_log.txt')
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"Search Error: Direct: {str(e1)}, Proxy: {str(e2)}\n")
                return None

    def log_error(self, msg):
        log_path = os.path.join(os.getenv('APPDATA'), 'js_error_log.txt')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"JS Error: {str(msg)}\n")
        return True

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

    def save_to_cache(self, query, data_json):
        try:
            db_path = get_db_path()
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO search_cache (query, results_json, timestamp)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (query, data_json))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            return False

    def get_from_cache(self, query):
        try:
            db_path = get_db_path()
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT results_json FROM search_cache WHERE query = ?', (query,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return row[0]
            return None
        except Exception as e:
            return None

    def search_local_hadith(self, query):
        try:
            db_path = resource_path('local_hadith.db')
            if not os.path.exists(db_path):
                db_path = 'local_hadith.db'
            
            import urllib.request
            db_uri = 'file:' + urllib.request.pathname2url(os.path.abspath(db_path)) + '?mode=ro'
            conn = sqlite3.connect(db_uri, uri=True)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT book, text_ar, authenticity FROM ahadith 
                WHERE text_ar LIKE ? 
                LIMIT 50
            ''', ('%' + query + '%',))
            
            rows = cursor.fetchall()
            conn.close()
            
            results = []
            for row in rows:
                results.append({
                    'book': row[0],
                    'text': row[1],
                    'authenticity': row[2]
                })
            
            return json.dumps(results, ensure_ascii=False)
        except Exception as e:
            return json.dumps([])

if __name__ == '__main__':
    init_db()
    api = Api()
    html_file = resource_path('index.html')
    webview.create_window('تطبيق الموسوعة الحديثية', url=html_file, js_api=api, width=900, height=700)
    webview.start(http_server=True)
