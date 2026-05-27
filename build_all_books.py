import urllib.request
import csv
import sqlite3
import os
import ssl

BOOKS = {
    "Sahih_Al-Bukhari": ("صحيح البخاري", "sahih_al-bukhari_ahadith.utf8.csv", "صحيح"),
    "Sahih_Muslim": ("صحيح مسلم", "sahih_muslim_ahadith.utf8.csv", "صحيح"),
    "Sunan_Abu-Dawud": ("سنن أبي داود", "sunan_abu-dawud_ahadith.utf8.csv", "متنوع"),
    "Sunan_Al-Tirmidhi": ("سنن الترمذي", "sunan_al-tirmidhi_ahadith.utf8.csv", "متنوع"),
    "Sunan_Al-Nasai": ("سنن النسائي", "sunan_al-nasai_ahadith.utf8.csv", "متنوع"),
    "Sunan_Ibn-Maja": ("سنن ابن ماجه", "sunan_ibn-maja_ahadith.utf8.csv", "متنوع"),
    "Sunan_Al-Darimi": ("سنن الدارمي", "sunan_al-darimi_ahadith.utf8.csv", "متنوع"),
    "Maliks_Muwataa": ("موطأ مالك", "maliks_muwataa_ahadith.utf8.csv", "صحيح"),
    "Musnad_Ahmad_Ibn-Hanbal": ("مسند أحمد", "musnad_ahmad_ibn-hanbal_ahadith.utf8.csv", "متنوع")
}

def build_db():
    db_path = 'local_hadith.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ahadith (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book TEXT,
            text_ar TEXT,
            authenticity TEXT
        )
    ''')
    
    context = ssl._create_unverified_context()
    
    for folder, (arabic_name, filename, auth) in BOOKS.items():
        print(f"Processing {arabic_name}...")
        url = f"https://raw.githubusercontent.com/mhashim6/Open-Hadith-Data/master/{folder}/{filename}"
        csv_path = filename
        
        # Download if not exists
        if not os.path.exists(csv_path):
            print(f"Downloading {filename}...")
            try:
                with urllib.request.urlopen(url, context=context) as response, open(csv_path, 'wb') as out_file:
                    out_file.write(response.read())
            except Exception as e:
                print(f"Failed to download {filename}: {e}")
                continue
                
        # Insert into SQLite
        print(f"Inserting {arabic_name} into database...")
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Try to skip header, some files might not have headers, but let's assume they don't or the first row is ID 1.
            for row in reader:
                if not row: continue
                # Skip header if it is text
                if not row[0].isdigit():
                    continue
                # join everything after the ID column
                text_ar = " ".join(row[1:])
                # Clean text: remove newlines or extra spaces
                text_ar = text_ar.replace('\n', ' ').replace('\r', '').strip()
                cursor.execute('INSERT INTO ahadith (book, text_ar, authenticity) VALUES (?, ?, ?)', (arabic_name, text_ar, auth))
                
        # Cleanup CSV to save space
        os.remove(csv_path)

    conn.commit()
    conn.close()
    print("All books processed and local_hadith.db built successfully!")

if __name__ == '__main__':
    build_db()
