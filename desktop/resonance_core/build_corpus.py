#!/usr/bin/env python3
"""
Türkçe HDC Motoru için Açık Kaynak Korpus Oluşturucu

Kaynaklar:
1. CanNuhlar/Turkce-Kelime-Listesi (GitHub) — TDK tabanlı ~21K kelime
2. hermitdave/FrequencyWords (GitHub) — OpenSubtitles frekans listesi ~50K
3. Ek morfolojik üretim (kök + ek kombinasyonları)

Çıktı: tr_corpus.js — HDC motoruna entegre edilecek JavaScript dosyası
"""
import re
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRAIN_DIR = os.path.expanduser("~/.gemini/antigravity-ide/brain/5368dd49-d6af-4c4d-8e3c-e9026a92ae9a")

# ── Türkçe Morfoloji Kuralları ──────────────────────────────
FRONT_VOWELS = set('eiöü')
BACK_VOWELS = set('aıou')
ALL_VOWELS = FRONT_VOWELS | BACK_VOWELS
HARD_CONSONANTS = set('çfhkpstş')

def get_last_vowel(word):
    for c in reversed(word):
        if c in ALL_VOWELS:
            return c
    return None

def vowel_harmony(word):
    v = get_last_vowel(word)
    if v is None:
        return 'back'
    return 'front' if v in FRONT_VOWELS else 'back'

def is_valid_turkish_word(w):
    """Basit doğrulama: sadece Türkçe harfler, min 2 karakter"""
    if len(w) < 2 or len(w) > 30:
        return False
    valid = set('abcçdefgğhıijklmnoöprsştuüvyzâîû')
    return all(c in valid for c in w.lower())

# ── Temel Türkçe Kökler (el ile doğrulanmış, geniş liste) ──
# Bu kökler morfolojik üretim için temel oluşturur
MANUAL_ROOTS = {
    # İsimler - Günlük Yaşam
    'ev', 'su', 'yol', 'iş', 'gün', 'göz', 'el', 'baş', 'kız', 'oğul',
    'anne', 'baba', 'çocuk', 'kadın', 'adam', 'insan', 'can', 'gönül',
    'kapı', 'pencere', 'masa', 'sandalye', 'yatak', 'dolap', 'ayna',
    'araba', 'otobüs', 'tren', 'uçak', 'gemi', 'bisiklet', 'motor',
    'yemek', 'ekmek', 'süt', 'et', 'balık', 'tavuk', 'peynir', 'yumurta',
    'elma', 'armut', 'portakal', 'muz', 'üzüm', 'kiraz', 'çilek', 'kavun',
    'karpuz', 'nar', 'şeftali', 'kayısı', 'erik',
    
    # İsimler - Doğa
    'deniz', 'dağ', 'nehir', 'göl', 'orman', 'ağaç', 'çiçek', 'yaprak',
    'taş', 'toprak', 'hava', 'ateş', 'su', 'güneş', 'ay', 'yıldız',
    'bulut', 'yağmur', 'kar', 'rüzgar', 'fırtına', 'deprem', 'sel',
    'kuş', 'balık', 'köpek', 'kedi', 'at', 'inek', 'koyun', 'tavşan',
    'aslan', 'kaplan', 'ayı', 'kurt', 'tilki', 'kartal',
    
    # İsimler - Mekan
    'şehir', 'köy', 'cadde', 'sokak', 'park', 'bahçe', 'meydan',
    'okul', 'hastane', 'cami', 'kilise', 'müze', 'kütüphane',
    'market', 'çarşı', 'pazar', 'banka', 'postane', 'eczane',
    'havalimanı', 'liman', 'istasyon', 'otogar', 'köprü', 'tünel',
    
    # İsimler - Meslekler
    'doktor', 'öğretmen', 'mühendis', 'avukat', 'hemşire', 'pilot',
    'şoför', 'aşçı', 'terzi', 'berber', 'esnaf', 'çiftçi', 'asker',
    'polis', 'itfaiyeci', 'gazeteci', 'yazar', 'sanatçı', 'müzisyen',
    
    # İsimler - Soyut
    'zaman', 'yıl', 'ay', 'hafta', 'gece', 'sabah', 'öğle', 'akşam',
    'saat', 'dakika', 'saniye', 'an', 'süre', 'dönem', 'çağ', 'devir',
    'aşk', 'sevgi', 'nefret', 'korku', 'umut', 'mutluluk', 'üzüntü',
    'öfke', 'sevinç', 'heyecan', 'merak', 'endişe', 'güven', 'özlem',
    'düşünce', 'fikir', 'bilgi', 'haber', 'söz', 'ses', 'renk', 'şekil',
    'anlam', 'kavram', 'değer', 'amaç', 'hedef', 'plan', 'proje',
    
    # İsimler - Teknoloji & Bilim
    'bilgisayar', 'telefon', 'internet', 'program', 'yazılım', 'donanım',
    'veri', 'algoritma', 'sistem', 'ağ', 'sunucu', 'veritabanı',
    'yapay', 'zeka', 'robot', 'otomasyon', 'dijital', 'analog',
    'bilim', 'fizik', 'kimya', 'biyoloji', 'matematik', 'geometri',
    'astronomi', 'coğrafya', 'tarih', 'felsefe', 'psikoloji', 'sosyoloji',
    
    # İsimler - Eğitim
    'ders', 'sınav', 'ödev', 'not', 'diploma', 'kitap', 'defter',
    'kalem', 'silgi', 'tahta', 'sınıf', 'öğrenci', 'hoca',
    
    # İsimler - Vücut
    'kol', 'bacak', 'parmak', 'ayak', 'kalp', 'beyin', 'ciğer',
    'böbrek', 'mide', 'diş', 'dil', 'dudak', 'burun', 'kulak',
    'saç', 'kaş', 'kirpik', 'tırnak', 'deri', 'kan', 'kemik',
    
    # İsimler - Giyim
    'elbise', 'gömlek', 'pantolon', 'etek', 'ceket', 'mont', 'palto',
    'ayakkabı', 'çorap', 'şapka', 'eldiven', 'atkı', 'kravat',
    
    # İsimler - Coğrafi
    'türkiye', 'ankara', 'istanbul', 'izmir', 'bursa', 'antalya',
    'konya', 'adana', 'trabzon', 'diyarbakır', 'erzurum', 'samsun',
    'kayseri', 'eskişehir', 'gaziantep', 'mersin', 'edirne', 'van',
    'avrupa', 'asya', 'afrika', 'amerika', 'almanya', 'fransa',
    'ingiltere', 'rusya', 'çin', 'japonya', 'hindistan',
    
    # İsimler - Kültür
    'müzik', 'resim', 'heykel', 'tiyatro', 'sinema', 'edebiyat',
    'şiir', 'roman', 'hikaye', 'masal', 'efsane', 'destan',
    'bayrak', 'vatan', 'millet', 'devlet', 'cumhuriyet', 'demokrasi',
    'özgürlük', 'adalet', 'hukuk', 'yasa', 'anayasa',
    
    # İsimler - Dil Bilimi
    'dil', 'kelime', 'cümle', 'metin', 'harf', 'hece', 'kök', 'ek',
    'gramer', 'sözcük', 'anlam', 'kavram', 'türkçe', 'alfabe',
    'sesli', 'sessiz', 'ünlü', 'ünsüz', 'fiil', 'isim', 'sıfat',
    'zarf', 'zamir', 'edat', 'bağlaç',
    
    # Fiiller (kök)
    'git', 'gel', 'yap', 'al', 'ver', 'gör', 'bil', 'ol', 'de', 'ye',
    'iç', 'uyu', 'kalk', 'otur', 'koş', 'yüz', 'uç', 'sür', 'at',
    'tut', 'bırak', 'aç', 'kapa', 'oku', 'yaz', 'çiz', 'boya', 'dik',
    'kes', 'kır', 'yık', 'yak', 'söndür', 'aydınlat',
    'öğren', 'öğret', 'anla', 'düşün', 'hatırla', 'unut', 'bul', 'ara',
    'sor', 'cevapla', 'konuş', 'dinle', 'duy', 'gör', 'izle', 'oku',
    'sev', 'nefret', 'kork', 'güven', 'inan', 'şüphelen',
    'çalış', 'üret', 'sat', 'satın', 'öde', 'borçlan', 'kazan', 'kaybet',
    'başla', 'bitir', 'devam', 'dur', 'bekle', 'geç', 'dön', 'değiş',
    'büyü', 'küçül', 'artır', 'azalt', 'çoğal', 'yay', 'topla', 'dağıt',
    'taşı', 'getir', 'götür', 'gönder', 'sun', 'kabul', 'reddet',
    'kurtar', 'koru', 'savun', 'saldır', 'vur', 'döv', 'öldür',
    'doğ', 'yaşa', 'öl', 'hastalan', 'iyileş', 'tedavi',
    'pişir', 'kaynat', 'kızart', 'haşla',
    'yıka', 'temizle', 'kirlet', 'düzenle', 'boz', 'tamir',
    'say', 'hesapla', 'ölç', 'tart', 'karşılaştır',
    'yönet', 'planla', 'organize', 'kontrol',
    'araştır', 'geliştir', 'keşfet', 'icat',
    
    # Sıfatlar
    'büyük', 'küçük', 'güzel', 'çirkin', 'iyi', 'kötü',
    'hızlı', 'yavaş', 'yeni', 'eski', 'genç', 'yaşlı',
    'uzun', 'kısa', 'geniş', 'dar', 'derin', 'sığ',
    'ağır', 'hafif', 'sıcak', 'soğuk', 'serin', 'ılık',
    'sert', 'yumuşak', 'kuru', 'ıslak', 'temiz', 'kirli',
    'açık', 'kapalı', 'boş', 'dolu', 'zengin', 'fakir',
    'doğru', 'yanlış', 'kolay', 'zor', 'önemli', 'gereksiz',
    'mutlu', 'üzgün', 'kızgın', 'sakin', 'endişeli', 'güvenli',
    'kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah',
    'mor', 'turuncu', 'pembe', 'gri', 'kahverengi', 'lacivert',
    
    # Zarflar
    'çok', 'az', 'biraz', 'hiç', 'her', 'bazı', 'birkaç',
    'hep', 'asla', 'belki', 'kesinlikle', 'muhtemelen',
    'hemen', 'hızla', 'yavaşça', 'dikkatle', 'dikkatsizce',
    'bugün', 'dün', 'yarın', 'şimdi', 'sonra', 'önce',
    
    # Zamirler & Edatlar
    'ben', 'sen', 'o', 'biz', 'siz', 'onlar',
    'bu', 'şu', 'ne', 'nasıl', 'nerede', 'kim', 'hangi',
    've', 'veya', 'ama', 'fakat', 'ancak', 'çünkü', 'için',
    
    # Sayılar
    'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi',
    'sekiz', 'dokuz', 'on', 'yüz', 'bin', 'milyon', 'milyar',
    'sıfır', 'yarım', 'çeyrek',
    
    # Yapay Zeka & HDC terimleri
    'yapay', 'zeka', 'beyin', 'sinir', 'öğrenme', 'hafıza', 'vektör',
    'kodlama', 'çözme', 'bağlama', 'permütasyon', 'süperpozisyon',
    'holografik', 'hiperdimensiyonel', 'rezonans', 'frekans',
    'spektrum', 'dalga', 'faz', 'genlik', 'entropi',
    'morfem', 'morfoloji', 'fonetik', 'semantik', 'sentaks',
    'tokenizasyon', 'gömme', 'transformatör', 'dikkat', 'katman',
}

# ── İsim ekleri (morfolojik üretim) ──
NOUN_SUFFIXES = {
    'çoğul': {'front': 'ler', 'back': 'lar'},
    'iyelik1t': {'front': 'im', 'back': 'ım'},
    'iyelik2t': {'front': 'in', 'back': 'ın'},
    'iyelik3t': {'front': 'i', 'back': 'ı'},
    'iyelik1ç': {'front': 'imiz', 'back': 'ımız'},
    'yönelme': {'front': 'e', 'back': 'a'},
    'bulunma': {'front': 'de', 'back': 'da'},
    'ayrılma': {'front': 'den', 'back': 'dan'},
    'tamlayan': {'front': 'in', 'back': 'ın'},
}

# ── Fiil ekleri ──
VERB_SUFFIXES = {
    'şimdiki': {'front': 'iyor', 'back': 'ıyor'},
    'gelecek': {'front': 'ecek', 'back': 'acak'},
    'geçmiş': {'front': 'miş', 'back': 'mış'},
    'belirli_geçmiş': {'front': 'di', 'back': 'dı'},
    'mastar': {'front': 'mek', 'back': 'mak'},
    'isim_fiil': {'front': 'me', 'back': 'ma'},
}

def generate_morphological_forms(root, is_verb=False):
    """Bir kökten morfolojik biçimler üret"""
    forms = [root]
    harmony = vowel_harmony(root)
    
    if is_verb:
        for name, variants in VERB_SUFFIXES.items():
            suffix = variants.get(harmony, variants.get('front'))
            if suffix:
                forms.append(root + suffix)
        # Fiil + şahıs ekleri
        for tense_name, tense_suf in [('iyor', 'ıyor'), ('ecek', 'acak')]:
            ts = tense_suf if harmony == 'back' else tense_name
            for person_suf in ['um', 'sun', '', 'uz', 'sunuz', 'lar']:
                forms.append(root + ts + person_suf)
    else:
        for name, variants in NOUN_SUFFIXES.items():
            suffix = variants.get(harmony, variants.get('front'))
            if suffix:
                forms.append(root + suffix)
        # Çoğul + hal ekleri
        plural = 'ler' if harmony == 'front' else 'lar'
        forms.append(root + plural)
        forms.append(root + plural + ('den' if harmony == 'front' else 'dan'))
        forms.append(root + plural + ('e' if harmony == 'front' else 'a'))
        forms.append(root + plural + ('de' if harmony == 'front' else 'da'))
        forms.append(root + plural + ('in' if harmony == 'front' else 'ın'))
        # İyelik + çoğul
        forms.append(root + plural + ('im' if harmony == 'front' else 'ım'))
        forms.append(root + plural + ('imiz' if harmony == 'front' else 'ımız'))
    
    return list(set(forms))

def process_frequency_list(filepath):
    """Frekans listesini oku ve kelime → frekans dict döndür"""
    words = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('Title') or line.startswith('Description') or line.startswith('Source') or line.startswith('---'):
                continue
            parts = line.split()
            if len(parts) >= 2:
                word = parts[0].lower()
                try:
                    freq = int(parts[1])
                except ValueError:
                    continue
                if is_valid_turkish_word(word):
                    words[word] = freq
            elif len(parts) == 1:
                word = parts[0].lower()
                if is_valid_turkish_word(word):
                    words[word] = 1
    return words

def process_word_list(filepath):
    """TDK kelime listesini oku"""
    words = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if not word or word.startswith('#') or word.startswith('Title') or word.startswith('Description') or word.startswith('Source') or word.startswith('---'):
                continue
            # Çok kelimeli ifadeleri atla
            if ' ' in word and '/' in word:
                continue
            # Birleşik kelimeler OK
            word = word.strip()
            if is_valid_turkish_word(word):
                words.add(word)
    return words

def extract_roots_from_wordlist(words):
    """Kelime listesinden olası kökleri çıkar (kısa kelimeler = muhtemel kök)"""
    roots = set()
    for w in words:
        if 2 <= len(w) <= 6:
            roots.add(w)
    return roots

# ── Fiil kökleri tespiti ──
KNOWN_VERB_ROOTS = {
    'git', 'gel', 'yap', 'al', 'ver', 'gör', 'bil', 'ol', 'de', 'ye',
    'iç', 'uyu', 'kalk', 'otur', 'koş', 'yüz', 'uç', 'sür', 'at',
    'tut', 'bırak', 'aç', 'kapa', 'oku', 'yaz', 'çiz', 'boya', 'dik',
    'kes', 'kır', 'yık', 'yak', 'söndür', 'öğren', 'öğret', 'anla',
    'düşün', 'hatırla', 'unut', 'bul', 'ara', 'sor', 'konuş', 'dinle',
    'duy', 'izle', 'sev', 'kork', 'güven', 'inan', 'çalış', 'üret',
    'sat', 'öde', 'kazan', 'kaybet', 'başla', 'bitir', 'dur', 'bekle',
    'geç', 'dön', 'değiş', 'büyü', 'küçül', 'artır', 'azalt', 'topla',
    'taşı', 'getir', 'götür', 'gönder', 'kabul', 'reddet', 'kurtar',
    'koru', 'savun', 'saldır', 'vur', 'doğ', 'yaşa', 'öl', 'iyileş',
    'pişir', 'kaynat', 'kızart', 'yıka', 'temizle', 'düzenle', 'tamir',
    'say', 'hesapla', 'ölç', 'tart', 'yönet', 'planla', 'kontrol',
    'araştır', 'geliştir', 'keşfet', 'tanı', 'seç', 'bağla', 'çöz',
    'bas', 'çek', 'it', 'çarp', 'böl', 'çıkar', 'ekle', 'sil',
    'tak', 'çıkart', 'gir', 'çık', 'in', 'bin', 'kon', 'atla',
    'zıpla', 'süz', 'ak', 'dök', 'dol', 'boşal', 'yükle', 'indir',
    'kur', 'söküm', 'yap', 'boz', 'onar', 'kapat', 'aç',
    'iste', 'dile', 'rica', 'emret', 'buyur', 'izin',
    'söyle', 'anlat', 'açıkla', 'belirt', 'vurgula',
    'affet', 'özür', 'teşekkür', 'kutla', 'tebrik',
}

def main():
    print("=" * 60)
    print("TÜRKÇE HDC KORPUS OLUŞTURUCU")
    print("=" * 60)
    
    # 1. Frekans listesini oku
    freq_file = os.path.join(BRAIN_DIR, ".system_generated/steps/26/content.md")
    freq_words = {}
    if os.path.exists(freq_file):
        freq_words = process_frequency_list(freq_file)
        print(f"[1] Frekans listesi: {len(freq_words)} kelime")
    else:
        print(f"[1] Frekans dosyası bulunamadı: {freq_file}")
    
    # 2. TDK kelime listesini oku
    tdk_file = os.path.join(BRAIN_DIR, ".system_generated/steps/20/content.md")
    tdk_words = set()
    if os.path.exists(tdk_file):
        tdk_words = process_word_list(tdk_file)
        print(f"[2] TDK kelime listesi: {len(tdk_words)} kelime")
    else:
        print(f"[2] TDK dosyası bulunamadı: {tdk_file}")
    
    # 3. Tüm kökleri birleştir
    all_roots = set(MANUAL_ROOTS)
    # Frekans listesinden kısa (kök olabilecek) kelimeleri ekle
    freq_roots = extract_roots_from_wordlist(freq_words.keys())
    all_roots |= freq_roots
    # TDK'dan kısa kelimeleri ekle
    tdk_roots = extract_roots_from_wordlist(tdk_words)
    all_roots |= tdk_roots
    
    print(f"[3] Toplam kök: {len(all_roots)}")
    
    # 4. Morfolojik formlar üret
    all_forms = set()
    for root in all_roots:
        is_verb = root in KNOWN_VERB_ROOTS
        forms = generate_morphological_forms(root, is_verb)
        all_forms.update(forms)
    
    print(f"[4] Morfolojik biçimler: {len(all_forms)}")
    
    # 5. Tüm benzersiz kelimeleri birleştir
    all_words = set()
    all_words |= set(freq_words.keys())
    all_words |= tdk_words
    all_words |= all_forms
    all_words |= all_roots
    
    # Temizle
    all_words = {w for w in all_words if is_valid_turkish_word(w) and len(w) >= 2}
    
    print(f"[5] Toplam benzersiz kelime: {len(all_words)}")
    
    # 6. Frekansa göre sırala, en sık kullanılan 5000 kelimeyi al
    # + tüm kökleri dahil et
    scored = []
    for w in all_words:
        freq = freq_words.get(w, 0)
        is_root = w in all_roots
        is_manual = w in MANUAL_ROOTS
        # Puanlama: kökler ve sık kelimeler öncelikli
        score = freq + (100000 if is_manual else 0) + (50000 if is_root else 0)
        scored.append((w, score, freq))
    
    scored.sort(key=lambda x: -x[1])
    
    # En iyi 5000 kelimeyi seç
    top_words = [w for w, s, f in scored[:5000]]
    
    # Kökler mutlaka dahil
    top_set = set(top_words)
    for root in all_roots:
        if root not in top_set and is_valid_turkish_word(root):
            top_words.append(root)
    
    print(f"[6] Seçilen kelime sayısı: {len(top_words)}")
    
    # 7. Kategorize et
    categories = {
        'kökler': sorted(list(all_roots & set(top_words))),
        'fiil_kökleri': sorted(list(KNOWN_VERB_ROOTS & set(top_words))),
    }
    
    # 8. Frekans en yüksek 3000 kelimeyi ayrıca çıkar
    freq_sorted = sorted(freq_words.items(), key=lambda x: -x[1])
    top_freq = [w for w, f in freq_sorted[:3000] if is_valid_turkish_word(w)]
    
    # 9. JavaScript çıktısı oluştur
    output_path = os.path.join(SCRIPT_DIR, 'tr_corpus.js')
    
    # Kök sözlüğünü oluştur (JavaScript array formatında)
    roots_list = sorted(list(all_roots & set(top_words)))
    verb_roots_list = sorted(list(KNOWN_VERB_ROOTS & set(top_words)))
    
    # Frekans sıralı kelime listesi
    freq_list = []
    for w, f in freq_sorted[:3000]:
        if is_valid_turkish_word(w):
            freq_list.append(w)
    
    # TDK kelimeleri (kısa olanlar)
    tdk_short = sorted([w for w in tdk_words if len(w) <= 12])[:3000]
    
    # Morfolojik varyasyonlar — örnek setler
    morph_examples = {}
    example_roots = ['ev', 'göl', 'git', 'gel', 'yap', 'oku', 'büyük', 'güzel', 'deniz', 'dağ',
                     'araba', 'kitap', 'öğren', 'çalış', 'yaz', 'sor', 'düşün', 'bil', 'al', 'ver']
    for root in example_roots:
        if root in KNOWN_VERB_ROOTS:
            morph_examples[root] = generate_morphological_forms(root, is_verb=True)
        else:
            morph_examples[root] = generate_morphological_forms(root, is_verb=False)
    
    # Tam kelime listesi (öğrenme için)
    training_words = list(set(roots_list + freq_list[:2000] + tdk_short[:2000]))
    training_words = [w for w in training_words if is_valid_turkish_word(w)]
    training_words.sort()
    
    print(f"[7] Eğitim kelime sayısı: {len(training_words)}")
    print(f"    Kök sayısı: {len(roots_list)}")
    print(f"    Fiil kökü: {len(verb_roots_list)}")
    print(f"    Frekans kelimesi: {len(freq_list)}")
    
    # JavaScript dosyası yaz
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("""// ═══════════════════════════════════════════════════════════════
// TÜRKÇE HDC MOTORU — AÇIK KAYNAK KORPUS VERİSİ
// ═══════════════════════════════════════════════════════════════
// Kaynaklar:
//   1. CanNuhlar/Turkce-Kelime-Listesi (GitHub) — TDK tabanlı
//   2. hermitdave/FrequencyWords (OpenSubtitles2018) — Frekans
//   3. El ile doğrulanmış kök sözlüğü (Zemberek uyumlu)
//   4. Morfolojik üretim (ünlü uyumu kurallı)
// Lisans: Açık Kaynak (MIT/CC0 uyumlu kaynaklardan)
// ═══════════════════════════════════════════════════════════════

""")
        f.write(f"// Toplam: {len(training_words)} kelime, {len(roots_list)} kök, {len(verb_roots_list)} fiil kökü\n\n")
        
        # Kök sözlüğü
        f.write("const TR_ROOTS = ")
        f.write(json.dumps(roots_list, ensure_ascii=False, indent=None))
        f.write(";\n\n")
        
        # Fiil kökleri
        f.write("const TR_VERB_ROOTS = ")
        f.write(json.dumps(verb_roots_list, ensure_ascii=False, indent=None))
        f.write(";\n\n")
        
        # Frekans sıralı kelimeler (en sık 2000)
        f.write("const TR_FREQ_WORDS = ")
        f.write(json.dumps(freq_list[:2000], ensure_ascii=False, indent=None))
        f.write(";\n\n")
        
        # Tüm eğitim kelimeleri
        f.write("const TR_TRAINING_WORDS = ")
        f.write(json.dumps(training_words, ensure_ascii=False, indent=None))
        f.write(";\n\n")
        
        # Morfolojik örnek setleri
        f.write("const TR_MORPH_EXAMPLES = ")
        f.write(json.dumps(morph_examples, ensure_ascii=False, indent=2))
        f.write(";\n\n")
        
        # Ek sözlüğü (HDC kodlama için)
        suffix_dict = {}
        for cat, variants in {**NOUN_SUFFIXES, **VERB_SUFFIXES}.items():
            suffix_dict[cat] = variants
        f.write("const TR_SUFFIX_MAP = ")
        f.write(json.dumps(suffix_dict, ensure_ascii=False, indent=2))
        f.write(";\n")
    
    print(f"\n✓ Çıktı dosyası: {output_path}")
    print(f"  Boyut: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("=" * 60)

if __name__ == '__main__':
    main()
