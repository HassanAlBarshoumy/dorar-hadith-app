import re

with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()

pattern = r"        // Visual Layer.*?card\.appendChild\(srTextarea\);"

new_card = '''        const contentWrapper = document.createElement('div');
        contentWrapper.id = contentId;
        contentWrapper.className = 'hadith-text-box';
        contentWrapper.setAttribute('contenteditable', 'true');
        contentWrapper.setAttribute('role', 'textbox');
        contentWrapper.setAttribute('aria-readonly', 'true');
        contentWrapper.setAttribute('aria-roledescription', 'مربع نص للقراءة فقط');
        contentWrapper.setAttribute('aria-multiline', 'true');
        contentWrapper.setAttribute('aria-label', 'نص الحديث');
        contentWrapper.setAttribute('tabindex', index === 0 ? '0' : '-1');
        
        // Prevent editing but allow screen reader navigation
        contentWrapper.addEventListener('keydown', (e) => {
            const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown', 'Shift', 'Control', 'Alt', 'c', 'a', 'C', 'A'];
            if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
            }
        });
        contentWrapper.addEventListener('paste', e => e.preventDefault());
        contentWrapper.addEventListener('cut', e => e.preventDefault());
        
        let enhancedInfoHtml = infoHtml || '';
        contentWrapper.innerHTML = hadithHtml + enhancedInfoHtml;
        card.appendChild(contentWrapper);'''

if re.search(pattern, js, re.DOTALL):
    js = re.sub(pattern, new_card.strip(), js, flags=re.DOTALL)
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print('Reverted to contenteditable')
else:
    print('Could not find via regex')
