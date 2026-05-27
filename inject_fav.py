import os
import json

settings_path = os.path.join(os.getenv('APPDATA'), 'dorar_settings.json')
with open(settings_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['favorites'] = [{
    'hadithHtml': '<div class="hadith">Test Hadith</div>',
    'infoHtml': '<div class="hadith-info">Test Info</div>',
    'originalHtml': '',
    'plainText': 'Test Hadith\n\nTest Info'
}]

with open(settings_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
print('Injected test favorite')
