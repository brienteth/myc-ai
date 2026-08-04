import re

with open('desktop/src/views/Automation.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useTranslation import
if 'import { useTranslation } from' not in content:
    content = content.replace("import './Automation.css';", "import './Automation.css';\nimport { useTranslation } from '../hooks/useTranslation';")

# Add t extraction
if 'const { t } = useTranslation();' not in content:
    content = content.replace("const [workflows, setWorkflows] = useState([]);", "const { t } = useTranslation();\n  const [workflows, setWorkflows] = useState([]);")

# Replace strings
content = content.replace('<h1>Automation OS</h1>', '<h1>{t("auto.title")}</h1>')
content = content.replace('<span className="badge">Intent Native</span>', '<span className="badge">{t("auto.subtitle")}</span>')

content = content.replace('Workflows', '{t("auto.tab.workflows")}')
content = content.replace('Templates', '{t("auto.tab.templates")}')
content = content.replace('Execution History', '{t("auto.tab.history")}')
content = content.replace('Vault Secrets', '{t("auto.tab.secrets")}')

content = content.replace('Generate via Intent', '{t("auto.gen.title")}')
content = content.replace('placeholder="e.g. Every hour, read clipboard and summarize it"', 'placeholder={t("auto.gen.placeholder")}')
content = content.replace('Create Workflow', '{t("auto.gen.btn")}')
content = content.replace('Planning DAG...', '{t("auto.gen.planning")}')

content = content.replace('Trigger', '{t("auto.trigger")}')
content = content.replace('Install Template', '{t("auto.install")}')

content = content.replace('Local Secure Vault', '{t("auto.vault.title")}')
content = content.replace('placeholder="Secret Key (e.g. TELEGRAM_TOKEN)"', 'placeholder={t("auto.vault.key")}')
content = content.replace('placeholder="Secret Value"', 'placeholder={t("auto.vault.val")}')
content = content.replace('Save Key', '{t("auto.vault.save")}')

content = content.replace('No Workflow Selected', '{t("auto.empty")}')
content = content.replace('Select a workflow from the list or create a new intent to view the execution graph.', '{t("auto.emptySub")}')
content = content.replace('Run once', '{t("auto.run")}')
content = content.replace('Intent', '{t("auto.mode.intent")}')
content = content.replace('Developer', '{t("auto.mode.developer")}')

content = content.replace('Directed Acyclic Graph (DAG) Layout', '{t("auto.dag")}')
content = content.replace('Depends', '{t("auto.deps")}')
content = content.replace('Requested Permissions', '{t("auto.perms")}')
content = content.replace('No special permissions requested.', '{t("auto.noPerms")}')

# Fix up the tabs since the replacement might have messed up 'workflows', 'templates' strings (lowercase ids).
# Oh actually I just replaced text literals, but let's check if it replaced 'workflows' or Workflows. I matched exact case 'Workflows'.

with open('desktop/src/views/Automation.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Translations applied to Automation.jsx")
