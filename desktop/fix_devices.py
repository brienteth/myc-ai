import re

with open("src/views/Devices.jsx", "r") as f:
    content = f.read()

content = content.replace('get{t("dev.status")}Text', 'getStatusText')

with open("src/views/Devices.jsx", "w") as f:
    f.write(content)
