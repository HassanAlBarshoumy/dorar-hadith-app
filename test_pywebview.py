import webview
import time
import os

html = """
<!DOCTYPE html>
<html>
<body>
<script>
    window.onload = function() {
        const keyword = 'test';
        const callbackName = 'dorar_cb_12345';
        window[callbackName] = function(data) {
            window.pywebview.api.log("Success: " + JSON.stringify(data).substring(0, 100));
        };
        
        const script = document.createElement('script');
        script.src = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(keyword)}&callback=${callbackName}`;
        script.onerror = (e) => {
            window.pywebview.api.log("JSONP Request failed onerror");
        };
        document.body.appendChild(script);
        
        // Also test fetch
        fetch(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(keyword)}`)
            .then(r => r.text())
            .then(t => window.pywebview.api.log("Fetch success: " + t.substring(0,100)))
            .catch(e => window.pywebview.api.log("Fetch error: " + e.message));
    };
</script>
</body>
</html>
"""

class Api:
    def log(self, msg):
        with open('test_pywebview_log.txt', 'a', encoding='utf-8') as f:
            f.write(msg + '\n')
        print("Logged:", msg)
        window.destroy()

if os.path.exists('test_pywebview_log.txt'):
    os.remove('test_pywebview_log.txt')

api = Api()
window = webview.create_window('Test', html=html, js_api=api)
webview.start(http_server=True)
