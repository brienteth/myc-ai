import re

with open("src/views/Automation.jsx", "r") as f:
    content = f.read()

content = content.replace('fetch{t("auto.tab.workflows")}', 'fetchWorkflows')
content = content.replace('set{t("auto.tab.workflows")}', 'setWorkflows')
content = content.replace('fetch{t("auto.tab.templates")}', 'fetchTemplates')
content = content.replace('set{t("auto.tab.templates")}', 'setTemplates')
content = content.replace('handlePlan{t("auto.mode.intent")}', 'handlePlanIntent')
content = content.replace('handle{t("auto.trigger")}Run', 'handleTriggerRun')
content = content.replace('// {t("auto.tab.secrets")} States', '// Secrets States')
content = content.replace("templates.map(t =>", "templates.map(tpl =>")
content = content.replace("{t.id}", "{tpl.id}")
content = content.replace("{t.name}", "{tpl.name}")
content = content.replace("{t.description}", "{tpl.description}")
content = content.replace("{t.trigger.type}", "{tpl.trigger.type}")

# Also fix the weird planning string
content = content.replace("{planning ? '{t(\"auto.gen.planning\")}' : '{t(\"auto.gen.btn\")}'}", "{planning ? t(\"auto.gen.planning\") : t(\"auto.gen.btn\")}")

with open("src/views/Automation.jsx", "w") as f:
    f.write(content)
