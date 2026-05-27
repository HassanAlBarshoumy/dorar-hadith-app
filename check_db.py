import sqlite3

conn = sqlite3.connect('local_hadith.db')
c = conn.cursor()
c.execute('SELECT text_ar FROM ahadith LIMIT 2')
rows = c.fetchall()

with open('test_bukhari.txt', 'w', encoding='utf-8') as f:
    for r in rows:
        f.write(r[0] + '\n')

conn.close()
