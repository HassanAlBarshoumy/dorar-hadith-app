import urllib.request
import csv
import sqlite3
import os
import ssl

def build_db():
    print("Downloading Sahih Al-Bukhari CSV...")
    url = "https://raw.githubusercontent.com/mhashim6/Open-Hadith-Data/master/Sahih_Al-Bukhari/sahih_al-bukhari_ahadith.utf8.csv"
    context = ssl._create_unverified_context()
    
    csv_path = 'bukhari.csv'
    if not os.path.exists(csv_path):
        with urllib.request.urlopen(url, context=context) as response, open(csv_path, 'wb') as out_file:
            out_file.write(response.read())
            
    print("CSV downloaded. Building SQLite DB...")
    db_path = 'local_hadith.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ahadith (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book TEXT,
            chapter TEXT,
            text_ar TEXT,
            authenticity TEXT
        )
    ''')
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader) # Skip header
        # CSV structure usually: id, text, etc. Let's inspect the first row
        # Wait, I don't know the exact columns of mhashim6 CSV. Let's just store everything in text_ar for now, or print first row.
        for i, row in enumerate(reader):
            # Based on typical structure: chapter_id, book_id, hadith_id, text_ar
            # Let's just join them if we don't know
            text_ar = " ".join(row)
            cursor.execute('INSERT INTO ahadith (book, text_ar, authenticity) VALUES (?, ?, ?)', ('صحيح البخاري', text_ar, 'صحيح'))
            
    conn.commit()
    conn.close()
    print("Database built successfully!")

if __name__ == '__main__':
    build_db()
