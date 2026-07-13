import re

with open('landing.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Nav links
content = content.replace('Why?</a>', 'Neden?</a>')
content = content.replace('How?</a>', 'Nasıl?</a>')
content = content.replace('Science</a>', 'Bilim</a>')
content = content.replace('Docs</a>', 'Belgeler</a>')
content = content.replace('Download</a>', 'İndir</a>')
content = content.replace('>Download<', '>İndir<')

# Hero
content = content.replace('OPEN SOURCE · FREE FOREVER', 'AÇIK KAYNAK · SONSUZA DEK ÜCRETSİZ')
content = content.replace('AI that lives<br>on your devices.', 'Cihazlarınızda<br>yaşayan yapay zeka.')
content = content.replace('myc connects your phone, laptop, and desktop into one private AI network. \n      No servers. No subscriptions. No data leaving your home.', 'myc telefonunuzu, dizüstü ve masaüstü bilgisayarınızı tek bir özel yapay zeka ağında birleştirir. Sunucu yok. Abonelik yok. Verileriniz evinizden çıkmaz.')
content = content.replace('Download for Mac', 'Mac için İndir')
content = content.replace('View on GitHub →', 'GitHub\'da Gör →')
content = content.replace('Response Time', 'Yanıt Süresi')
content = content.replace('To the Cloud', 'Buluta Giden')
content = content.replace('Offline Ready', 'Çevrimdışı Hazır')
content = content.replace('Running locally on MacBook Pro', 'MacBook Pro üzerinde yerel çalışıyor')

# The internet, but alive
content = content.replace('The internet, but alive.', 'İnternet, ama canlı.')

# Inject Language Switcher in Nav
nav_str = '<div class="nav-links">'
lang_switcher = '<a href="#" onclick="toggleLang(event)" id="langToggle" style="color:var(--green); font-weight:600;">TR / EN</a>'
content = content.replace(nav_str, nav_str + '\n    ' + lang_switcher)

# Inject JS for language toggle at the bottom
js_script = """
<script>
  let currentLang = localStorage.getItem('myca_lang') || 'tr';
  
  const dict = {
    "en": {
      "Neden?": "Why?", "Nasıl?": "How?", "Bilim": "Science", "Belgeler": "Docs", "İndir": "Download",
      "AÇIK KAYNAK · SONSUZA DEK ÜCRETSİZ": "OPEN SOURCE · FREE FOREVER",
      "Cihazlarınızda<br>yaşayan yapay zeka.": "AI that lives<br>on your devices.",
      "Mac için İndir": "Download for Mac", "GitHub'da Gör →": "View on GitHub →",
      "Yanıt Süresi": "Response Time", "Buluta Giden": "To the Cloud", "Çevrimdışı Hazır": "Offline Ready"
    },
    "tr": {
      "Why?": "Neden?", "How?": "Nasıl?", "Science": "Bilim", "Docs": "Belgeler", "Download": "İndir",
      "OPEN SOURCE · FREE FOREVER": "AÇIK KAYNAK · SONSUZA DEK ÜCRETSİZ",
      "AI that lives<br>on your devices.": "Cihazlarınızda<br>yaşayan yapay zeka.",
      "Download for Mac": "Mac için İndir", "View on GitHub →": "GitHub'da Gör →",
      "Response Time": "Yanıt Süresi", "To the Cloud": "Buluta Giden", "Offline Ready": "Çevrimdışı Hazır"
    }
  };

  function applyTranslation() {
    document.querySelectorAll('a, h1, p, div, span, button').forEach(el => {
      if(el.children.length > 0 && !el.innerHTML.includes('<br>')) return;
      let text = el.innerHTML.trim();
      let newText = dict[currentLang][text];
      if (newText) {
         el.innerHTML = newText;
      } else {
         text = el.innerText.trim();
         newText = dict[currentLang][text];
         if (newText) el.innerText = newText;
      }
    });
  }

  function toggleLang(e) {
    e.preventDefault();
    currentLang = currentLang === 'tr' ? 'en' : 'tr';
    localStorage.setItem('myca_lang', currentLang);
    applyTranslation();
  }

  window.addEventListener('DOMContentLoaded', () => {
    if(currentLang === 'en') {
      applyTranslation();
    }
  });
</script>
</body>
"""
content = content.replace('</body>', js_script)

with open('landing.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Translations applied to landing.html")
