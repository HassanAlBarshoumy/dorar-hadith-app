import sqlite3
import os

db_path = 'local_hadith.db'
db_path_uri = db_path.replace('\\', '/')
db_uri = f"file:{db_path_uri}?mode=ro"
conn = sqlite3.connect(db_uri, uri=True)
cursor = conn.cursor()
cursor.execute('''
    SELECT book, text_ar, authenticity FROM ahadith 
    WHERE text_ar LIKE ? 
    LIMIT 2
''', ('%صلاة%',))

rows = cursor.fetchall()
conn.close()

with open('test_search_result.txt', 'w', encoding='utf-8') as f:
    for row in rows:
        f.write(f"Book: {row[0]}\nAuth: {row[2]}\nText: {row[1]}\n\n")
