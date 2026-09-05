/**
 * Turkish Morphology Module
 * Handles normalization, vowel harmony analysis, suffix splitting, and feature extraction.
 */
export class TurkishMorphology {
  constructor(roots = []) {
    this.onVowels = new Set(['e', 'i', 'ö', 'ü']);
    this.backVowels = new Set(['a', 'ı', 'o', 'u']);
    this.allVowels = new Set(['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü']);
    
    this.customRoots = roots;
    
    // Suffix feature dictionary mapping
    this.suffixFeatures = {
      // Plural
      'ler': { number: 'plural' },
      'lar': { number: 'plural' },
      
      // Cases
      'den': { case: 'ablative' },
      'dan': { case: 'ablative' },
      'ten': { case: 'ablative' },
      'tan': { case: 'ablative' },
      'de': { case: 'locative' },
      'da': { case: 'locative' },
      'te': { case: 'locative' },
      'ta': { case: 'locative' },
      'e': { case: 'dative' },
      'a': { case: 'dative' },
      'in': { case: 'genitive', possession: '2sg' },
      'ın': { case: 'genitive', possession: '2sg' },
      'un': { case: 'genitive', possession: '2sg' },
      'ün': { case: 'genitive', possession: '2sg' },
      
      // Possessions
      'im': { possession: '1sg' },
      'ım': { possession: '1sg' },
      'um': { possession: '1sg' },
      'üm': { possession: '1sg' },
      'i': { possession: '3sg' },
      'ı': { possession: '3sg' },
      'u': { possession: '3sg' },
      'ü': { possession: '3sg' },
      'imiz': { possession: '1pl' },
      'ımız': { possession: '1pl' },
      'umuz': { possession: '1pl' },
      'ümüz': { possession: '1pl' },
      'iniz': { possession: '2pl' },
      'ınız': { possession: '2pl' },
      'ünüz': { possession: '2pl' },
      'unuz': { possession: '2pl' },
      'leri': { possession: '3pl' },
      'ları': { possession: '3pl' },
      
            // Negation (Olumsuzluk - Fiil)
      'masınlar': { polarity: 'negative', mood: 'imperative', person: '3pl' },
      'mesinler': { polarity: 'negative', mood: 'imperative', person: '3pl' },
      'mayınız': { polarity: 'negative', mood: 'imperative', person: '2pl' },
      'meyiniz': { polarity: 'negative', mood: 'imperative', person: '2pl' },
      'masın': { polarity: 'negative', mood: 'imperative', person: '3sg' },
      'mesin': { polarity: 'negative', mood: 'imperative', person: '3sg' },
      'mayın': { polarity: 'negative', mood: 'imperative', person: '2pl' },
      'meyin': { polarity: 'negative', mood: 'imperative', person: '2pl' },
      'mamalı': { polarity: 'negative', mood: 'necessitative' },
      'memeli': { polarity: 'negative', mood: 'necessitative' },
      'ma': { polarity: 'negative' },
      'me': { polarity: 'negative' },
      'mıyor': { polarity: 'negative', tense: 'present' },
      'miyor': { polarity: 'negative', tense: 'present' },
      'muyor': { polarity: 'negative', tense: 'present' },
      'müyor': { polarity: 'negative', tense: 'present' },
      'maz': { polarity: 'negative', tense: 'aorist' },
      'mez': { polarity: 'negative', tense: 'aorist' },
      'madı': { polarity: 'negative', tense: 'past' },
      'medi': { polarity: 'negative', tense: 'past' },
      // Tense/Aspect/Mood
      'iyor': { tense: 'present' },
      'ıyor': { tense: 'present' },
      'uyor': { tense: 'present' },
      'üyor': { tense: 'present' },
      'ecek': { tense: 'future' },
      'acak': { tense: 'future' },
      'miş': { tense: 'narrative_past' },
      'mış': { tense: 'narrative_past' },
      'müş': { tense: 'narrative_past' },
      'muş': { tense: 'narrative_past' },
      'di': { tense: 'past' },
      'dı': { tense: 'past' },
      'du': { tense: 'past' },
      'dü': { tense: 'past' },
      'ti': { tense: 'past' },
      'tı': { tense: 'past' },
      'tu': { tense: 'past' },
      'tü': { tense: 'past' },
      
      // Infinitives and derivations
      'mek': { aspect: 'infinitive' },
      'mak': { aspect: 'infinitive' },
      'lik': { derivation: 'noun' },
      'lık': { derivation: 'noun' },
      'luk': { derivation: 'noun' },
      'lük': { derivation: 'noun' },
      'li': { derivation: 'with' },
      'lı': { derivation: 'with' },
      'lu': { derivation: 'with' },
      'lü': { derivation: 'with' },
      'siz': { derivation: 'without' },
      'sız': { derivation: 'without' },
      'suz': { derivation: 'without' },
      'süz': { derivation: 'without' },
      'ce': { case: 'equative' },
      'ca': { case: 'equative' },
      'ça': { case: 'equative' },
      'çe': { case: 'equative' },
      // Copula (Assertive)
      'dir': { copula: 'assertive' },
      'dır': { copula: 'assertive' },
      'dur': { copula: 'assertive' },
      'dür': { copula: 'assertive' },
      'tir': { copula: 'assertive' },
      'tır': { copula: 'assertive' },
      'tur': { copula: 'assertive' },
      'tür': { copula: 'assertive' },
      // Relative Modifier
      'ki': { pronoun: 'relative' },
      'kiler': { pronoun: 'relative_plural' },
      // Adverbial / Manner
      'cesine': { aspect: 'manner' },
      'casına': { aspect: 'manner' },
      'ken': { adverb: 'temporal' },
      // Moods
      'meli': { mood: 'necessity' },
      'malı': { mood: 'necessity' },
      'se': { mood: 'conditional' },
      'sa': { mood: 'conditional' }
    };

    // Known suffixes ordered by length descending for greedy matching
    this.suffixesKnown = Object.keys(this.suffixFeatures).sort((a, b) => b.length - a.length);
  }

  // Allow dynamic roots fallback
  get roots() {
    if (this.customRoots && this.customRoots.length > 0) {
      return this.customRoots;
    }
    if (typeof globalThis !== 'undefined' && globalThis.TR_CORPUS_ROOTS) {
      return globalThis.TR_CORPUS_ROOTS;
    }
    // Minimal fallback root list
    return [
      // Genel yaygın kökler
      'ev', 'göl', 'araba', 'kitap', 'el', 'baş', 'git', 'gel', 'yap', 'al', 'ver', 'gör',
      'bilgisayar', 'bil', 'öğren', 'anla', 'düşün', 'büyük', 'küçük', 'güzel', 'iyi', 'kötü',
      'yapay', 'zeka', 'beyin', 'sinir', 'dil', 'kelime', 'cümle', 'türkçe', 'bilim', 'teknik',
      'okul', 'öğrenci', 'öğretmen', 'yazılım', 'donanım', 'renk',
      // Vücut / anatomi
      'ayak', 'göz', 'kulak', 'diz', 'omuz', 'karın', 'göğüs', 'sırt', 'boyun', 'kol',
      'bacak', 'parmak', 'bilek', 'topuk', 'alın', 'bel', 'diş', 'burun', 'ağız', 'ciğer',
      'kalp', 'akciğer', 'mide', 'böbrek', 'karaciğer', 'damar',
      // Tıbbi terimler
      'hasta', 'doktor', 'hemşire', 'ilaç', 'doz', 'tanı', 'tedavi', 'ameliyat',
      'hastalık', 'ağrı', 'şişlik', 'ateş', 'nabız', 'tansiyon', 'kan', 'idrar',
      'reçete', 'aşı', 'virüs', 'enfeksiyon', 'yara', 'kırık', 'ödem', 'alerji',
      'şeker', 'diyabet', 'gebelik', 'doğum', 'ölçüm', 'muayene', 'rapor', 'tahlil',
      // Genel isimler
      'yol', 'su', 'ekmek', 'para', 'iş', 'gün', 'yıl', 'saat', 'hafta', 'ay',
      'yer', 'şehir', 'ülke', 'köy', 'insan', 'kadın', 'erkek', 'çocuk', 'anne', 'baba',
      'ad', 'isim', 'aile', 'soru', 'cevap', 'kayıt', 'bilgi', 'durum', 'sonuç',
      // Sıfatlar ve zarflar
      'yeni', 'eski', 'uzun', 'kısa', 'sık', 'az', 'çok', 'son', 'ilk', 'her',
      // Fiiller (ek kökler)
      'oku', 'yaz', 'bak', 'çalış', 'ye', 'iç', 'uyu', 'kalk', 'otur', 'koş',
      'sor', 'söyle', 'dinle', 'bekle', 'başla', 'bitir', 'aç', 'kapat', 'getir', 'götür',
      'koy', 'çıkar', 'kaydet', 'güncelle', 'kontrol', 'durdur',
      // Endüstriyel, otomasyon ve mühendislik terimleri
      'dur', 'başla', 'konveyör', 'konveyor', 'pompa', 'dalgıç', 'hidrofor', 'selenoid', 'klepe', 'damper', 'aspiratör', 'blower', 'rezistans', 'brülör', 'redüktör', 'kontaktör', 'kesici', 'vana', 'motor', 'şalter', 'indir', 'kazan', 'basınç', 'arıza', 'valf', 'hız', 'boru',
      'tank', 'fan', 'ısıtıcı', 'ısıt', 'motor', 'kompresör', 'akım', 'gerilim', 'sıcaklık', 'soğut', 'hararet', 'şebeke', 'sensör', 'şalter'
    ];
  }

  determineVowelHarmony(root) {
    const lv = this.getLastVowel(root);
    return lv && this.onVowels.has(lv) ? 'front' : 'back';
  }

  getLastVowel(word) {
    for (let i = word.length - 1; i >= 0; i--) {
      if (this.allVowels.has(word[i])) return word[i];
    }
    return null;
  }

  normalize(text) {
    return text.toLowerCase().trim()
      .replace(/i̇/g, 'i') // fix combined i characters
      .replace(/[^a-z0-9çgğıoöşuüâîû\s\.\-]/g, ' ').replace(/\s+/g, ' '); // KEEP DIGITS & TURKISH CHARACTERS
  }

  analyze(word) {
    const w = this.normalize(word).split(/\s+/)[0];
    const result = {
      word: w,
      root: w,
      suffixes: [],
      harmony: this.determineVowelHarmony(w),
      morphemes: [],
      features: {},
      vowelCount: 0,
      syllables: []
    };

    if (!w) return result;

    result.vowelCount = [...w].filter(c => this.allVowels.has(c)).length;
    result.syllables = this.syllabify(w);

    // Greedy root-suffix splitter matching longest root with reverse consonant mutation support
    let foundRoot = w;
    let foundSuffs = [];

    for (const root of this.roots) {
      let isMatch = false;
      let matchedLength = root.length;

      if (w.startsWith(root)) {
        isMatch = true;
      } else {
        // Consonant mutation check (e.g. kitap -> kitabım, git -> gidiyor)
        const last = root[root.length - 1];
        if (['p', 'ç', 't', 'k'].includes(last)) {
          const stem = root.slice(0, -1);
          let mutatedStem = '';
          if (last === 'p') mutatedStem = stem + 'b';
          else if (last === 'ç') mutatedStem = stem + 'c';
          else if (last === 't') mutatedStem = stem + 'd';
          else if (last === 'k') mutatedStem = stem + 'ğ';

          // Renk -> rengi exception
          if (root === 'renk') mutatedStem = stem + 'g';

          if (w.startsWith(mutatedStem) && w.length > root.length) {
            // Next char in word must be a vowel for mutation to happen
            const nextChar = w[mutatedStem.length];
            if (this.allVowels.has(nextChar)) {
              isMatch = true;
              matchedLength = mutatedStem.length;
            }
          }
        }
      }

      if (isMatch && root.length >= 2 && root.length < w.length) {
        const suffix = w.slice(matchedLength);
        if (root.length > (foundRoot === w ? 0 : foundRoot.length)) {
          foundRoot = root;
          foundSuffs = this.splitSuffix(suffix);
        }
      }
    }

    result.root = foundRoot;
    result.suffixes = foundSuffs;
    result.morphemes = [foundRoot, ...foundSuffs].filter(Boolean);
    result.harmony = this.determineVowelHarmony(foundRoot);

    // Enrich features
    foundSuffs.forEach(suff => {
      const feat = this.suffixFeatures[suff];
      if (feat) {
        Object.assign(result.features, feat);
      }
    });

    return result;
  }

  splitSuffix(suffix) {
    if (!suffix) return [];
    const result = [];
    let rem = suffix;
    while (rem.length > 0) {
      let matched = false;
      for (const s of this.suffixesKnown) {
        if (rem.endsWith(s)) {
          result.unshift(s);
          rem = rem.slice(0, rem.length - s.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        result.unshift(rem); // fallback for unmatched leading segment
        break;
      }
    }
    return result;
  }

  syllabify(word) {
    const w = this.normalize(word);
    if (!w) return [];
    
    // Find indices of all vowels
    const vowelIndices = [];
    for (let i = 0; i < w.length; i++) {
      if (this.allVowels.has(w[i])) {
        vowelIndices.push(i);
      }
    }
    
    if (vowelIndices.length <= 1) {
      return [w];
    }
    
    const syllables = [];
    let start = 0;
    
    // Split word step-by-step based on vowel gaps according to Turkish grammar rules
    for (let k = 0; k < vowelIndices.length - 1; k++) {
      const v1 = vowelIndices[k];
      const v2 = vowelIndices[k + 1];
      const consonantCount = v2 - v1 - 1;
      
      let splitPoint;
      if (consonantCount === 0) {
        // V-V -> e.g. fi-il
        splitPoint = v1 + 1;
      } else if (consonantCount === 1) {
        // V-C-V -> division before the consonant ( liaison / ulama rule )
        splitPoint = v1 + 1;
      } else if (consonantCount === 2) {
        // V-C-C-V -> division between the two consonants
        splitPoint = v1 + 2;
      } else {
        // V-C-C-C-V or more -> division before the last consonant
        splitPoint = v2 - 1;
      }
      
      syllables.push(w.slice(start, splitPoint));
      start = splitPoint;
    }
    syllables.push(w.slice(start));
    return syllables.filter(Boolean);
  }

  syllabifyPhrase(phrase) {
    const words = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    if (words.length === 1) return this.syllabify(words[0]);

    const resultSyllables = [];
    const processedWords = [...words];

    for (let i = 0; i < processedWords.length - 1; i++) {
      const w1 = processedWords[i];
      const w2 = processedWords[i + 1];
      if (w1.length === 0 || w2.length === 0) continue;
      
      const lastChar = w1[w1.length - 1];
      const firstChar = w2[0];
      
      // Liaison: ends in consonant, starts in vowel
      if (!this.allVowels.has(lastChar) && this.allVowels.has(firstChar)) {
        processedWords[i] = w1.slice(0, -1);
        processedWords[i + 1] = lastChar + w2;
      }
    }

    for (const w of processedWords) {
      if (w.length > 0) {
        resultSyllables.push(...this.syllabify(w));
      }
    }
    return resultSyllables;
  }
}
