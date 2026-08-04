import re

with open('desktop/src/views/Settings.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<h3>System Prompt</h3>', '<h3>{t("set.systemPrompt")}</h3>')
content = content.replace('Save Prompt', '{t("set.savePrompt")}')
content = content.replace('<h3>Short-Term Memory Management</h3>', '<h3>{t("set.memory")}</h3>')
content = content.replace('Clear Memory', '{t("set.clearMemory")}')

with open('desktop/src/views/Settings.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Translations applied to Settings.jsx")
