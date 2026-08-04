import re

with open('desktop/src/views/Library.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace static strings
content = content.replace('<h1>Library</h1>', '<h1>{t("nav.library")}</h1>')
content = content.replace('<span>Upload Files</span>', '<span>{t("lib.uploadFiles")}</span>')
content = content.replace('placeholder="Search (semantic)..."', 'placeholder={t("lib.searchPlaceholder")}')

content = content.replace('Drop files here to upload', '{t("lib.dropZone")}')
content = content.replace('Research tab indexes web sources.', '{t("lib.dropZoneResearch")}')
content = content.replace('placeholder="Add URL for research and hit Enter..."', 'placeholder={t("lib.addUrl")}')

content = content.replace('No Files in Library', '{t("lib.empty")}')
content = content.replace('Start adding your documents, media, or web URLs to research them.', '{t("lib.emptySub")}')
content = content.replace('Browse Files', '{t("lib.browseFiles")}')

with open('desktop/src/views/Library.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Translations applied to Library.jsx")
