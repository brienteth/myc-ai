import re

with open('desktop/src/views/Devices.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { useTranslation } from' not in content:
    content = content.replace("import './Devices.css';", "import './Devices.css';\nimport { useTranslation } from '../hooks/useTranslation';")

if 'const { t } = useTranslation();' not in content:
    content = content.replace("const [nodes, setNodes] = useState([]);", "const { t } = useTranslation();\n  const [nodes, setNodes] = useState([]);")

content = content.replace('<h1>Autonomous Swarm</h1>', '<h1>{t("dev.title")}</h1>')
content = content.replace('<span className="badge">Decentralized Compute Grid</span>', '<span className="badge">{t("dev.subtitle")}</span>')

content = content.replace('Network', '{t("dev.tab.network")}')
content = content.replace('Metrics', '{t("dev.tab.metrics")}')
content = content.replace('My Node', '{t("dev.myNode")}')

content = content.replace('Role', '{t("dev.role")}')
content = content.replace('Status', '{t("dev.status")}')
content = content.replace('Shards', '{t("dev.shards")}')
content = content.replace('Connected Peers', '{t("dev.connectedPeers")}')
content = content.replace('No other peers found on the network. Waiting for swarm...', '{t("dev.noPeers")}')
content = content.replace('tok/s', '{t("dev.tps")}')

with open('desktop/src/views/Devices.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Translations applied to Devices.jsx")
