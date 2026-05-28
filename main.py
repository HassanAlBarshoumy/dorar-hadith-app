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
            # Fallback proxy if Cloudflare blocks or network fails
            try:
                proxy_url = "https://corsproxy.io/?" + urllib.parse.quote(target_url)
                proxy_req = urllib.request.Request(
                    proxy_url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(proxy_req, timeout=10, context=context) as response:
                    return response.read().decode('utf-8')
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
        except Exception as e:
            print(f"Error saving settings: {e}")
            return False

    def show_notification(self, title, body, full_text='', book='', authenticity=''):
        import subprocess
        import base64
        import html as html_mod
        
        # Save full hadith as styled HTML page
        hadith_html_path = ''
        if full_text:
            hadith_dir = os.path.dirname(get_db_path())
            os.makedirs(hadith_dir, exist_ok=True)
            hadith_html_path = os.path.join(hadith_dir, 'last_hadith.html')
            
            escaped_text = html_mod.escape(full_text)
            escaped_book = html_mod.escape(book)
            escaped_auth = html_mod.escape(authenticity)
            
            html_content = f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>الموسوعة الحديثية</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1f3c 100%);
    color: #e8e8e8; min-height: 100vh;
    display: flex; justify-content: center; align-items: center; padding: 2rem;
}}
.card {{
    background: rgba(255,255,255,0.08); backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 20px;
    padding: 2.5rem; max-width: 700px; width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}}
.title {{
    color: #64b5f6; font-size: 1.1rem; margin-bottom: 1.5rem;
    text-align: center; font-weight: 600;
    border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;
}}
.hadith-text {{
    font-size: 1.25rem; line-height: 2.2; color: #f0f0f0;
    text-align: justify; margin-bottom: 1.5rem;
    padding: 1.5rem; background: rgba(255,255,255,0.04);
    border-radius: 12px; border-right: 4px solid #64b5f6;
}}
.info {{ display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }}
.info-tag {{
    background: rgba(100,181,246,0.15); color: #90caf9;
    padding: 0.5rem 1.2rem; border-radius: 25px; font-size: 0.9rem;
}}
</style>
</head>
<body>
<div class="card">
    <div class="title">🕌 الموسوعة الحديثية</div>
    <div class="hadith-text">{escaped_text}</div>
    <div class="info">
        <span class="info-tag">📖 المصدر: {escaped_book}</span>
        <span class="info-tag">✅ الحكم: {escaped_auth}</span>
    </div>
</div>
</body>
</html>'''
            with open(hadith_html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            hadith_html_path = hadith_html_path.replace('\\\\', '/')
        
        # Escape for XML
        def xml_escape(s):
            return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace("'", '&apos;').replace('"', '&quot;').replace('\\n', ' ').replace('\\r', '')
        
        title_esc = xml_escape(title)
        body_esc = xml_escape(body)
        
        # Build toast with button if we have full text
        if hadith_html_path:
            file_uri = 'file:///' + hadith_html_path.replace('\\\\', '/').replace(' ', '%20')
            toast_xml = f'''
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>{title_esc}</text>
      <text>{body_esc}</text>
    </binding>
  </visual>
  <actions>
    <action content="عرض الحديث كاملاً" activationType="protocol" arguments="{file_uri}"/>
  </actions>
</toast>'''
            ps_script = f'''
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xmlDoc = New-Object Windows.Data.Xml.Dom.XmlDocument
$xmlDoc.LoadXml(@"
{toast_xml}
"@)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('الموسوعة الحديثية')
$notifier.Show($toast)
'''
        else:
            ps_script = f'''
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName('text')
$textNodes.Item(0).AppendChild($template.CreateTextNode('{title_esc}')) | Out-Null
$textNodes.Item(1).AppendChild($template.CreateTextNode('{body_esc}')) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('الموسوعة الحديثية')
$notifier.Show($toast)
'''
        try:
            encoded_cmd = base64.b64encode(ps_script.encode('utf-16-le')).decode('ascii')
            subprocess.Popen(['powershell', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded_cmd], creationflags=subprocess.CREATE_NO_WINDOW)
            return True
        except Exception as e:
            print(f"Error showing notification: {e}")
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

    def search_local_hadith(self, query, page=1, books_filter=None):
        try:
            db_path = resource_path('local_hadith.db')
            if not os.path.exists(db_path):
                db_path = 'local_hadith.db'
            
            import urllib.request
            db_uri = 'file:' + urllib.request.pathname2url(os.path.abspath(db_path)) + '?mode=ro'
            conn = sqlite3.connect(db_uri, uri=True)
            cursor = conn.cursor()
            page = int(page)
            offset = (page - 1) * 20
            if books_filter == 'bukhari_muslim':
                cursor.execute('''
                    SELECT book, text_ar, authenticity FROM ahadith 
                    WHERE text_ar LIKE ? AND (book LIKE '%البخاري%' OR book LIKE '%مسلم%')
                    ORDER BY RANDOM() LIMIT 20
                ''', ('%' + query + '%',))
            else:
                cursor.execute('''
                    SELECT book, text_ar, authenticity FROM ahadith 
                    WHERE text_ar LIKE ? 
                    LIMIT 20 OFFSET ?
                ''', ('%' + query + '%', offset))
            
            rows = cursor.fetchall()
            conn.close()
            
            results = []
            for row in rows:
                results.append({
                    'book': row[0],
                    'text_ar': row[1],
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
