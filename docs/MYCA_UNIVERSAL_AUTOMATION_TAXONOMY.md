# Myca Universal Automation Taxonomy & 10 Canonical Skill Layers

> **Architectural Shift:**
> Myca is NOT a vertical ERP or niche industry app; it is an **AI-Native Execution Operating System**.
> Rather than building isolated industry silos, Myca defines **Universal Automation Primitives** drawn from the top action patterns of Zapier, n8n, Make, Power Automate, UiPath, Langflow, OpenHands, and MCP Servers.
> The Planner composes these atomic building blocks into any domain workflow dynamically.

---

## 1. The 10 Canonical Execution OS Skill Layers

```text
                                MYCA EXECUTION OS
                                        │
┌───────────────────────────────────────┴──────────────────────────────────────┐
│                                                                              │
├─► 1. Core OS Skills           (Filesystem, API, Database, Scheduler, Queue)  │
├─► 2. Knowledge Skills         (Document, OCR, Search, Vector, RAG, Index)    │
├─► 3. AI Skills                (LLM, Vision, Audio, Embedding, Reasoning)     │
├─► 4. Business Skills          (CRM, ERP, Finance, HR, Invoicing)             │
├─► 5. Developer Skills         (Git, Docker, Terminal, Kubernetes, CI/CD)     │
├─► 6. Creative Skills          (Image, Video, Audio, Presentation, Graphics)  │
├─► 7. Communication Skills     (Email, Slack, Teams, WhatsApp, Push)          │
├─► 8. Commerce Skills          (E-Commerce, Payments, Inventory, Checkout)    │
├─► 9. Automation Skills       (Triggers, Conditions, Loops, Approval, Retry) │
└─► 10. Execution OS Skills     (Policy, Permission, Secret, Router, Colony)   │
```

---

## 2. Universal Action Primitives Index

### 📊 Data & Format Transformation
- `data.merge`, `data.split`, `data.filter`, `data.sort`, `data.group`, `data.aggregate`, `data.validate`, `data.clean`, `data.normalize`, `data.transform`.
- `json.parse`, `json.stringify`, `json.query`, `json.merge`, `json.validate`.
- `csv.read`, `csv.write`, `csv.merge`, `csv.filter`, `csv.export`.
- `xml.read`, `xml.write`, `xml.validate`, `xml.transform`, `xml.query`.

### 🌍 API & Connectivity
- `api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`, `api.graphql`, `api.soap`, `api.auth`, `api.retry`, `api.pagination`.
- `http.request`, `http.download`, `http.upload`, `http.headers`, `http.cookies`.
- `webhook.listen`, `webhook.send`, `webhook.verify`, `webhook.retry`, `webhook.history`.

### 🗄️ Persistence, Caching & Message Queues
- `database.query`, `database.insert`, `database.update`, `database.delete`, `database.transaction`, `database.backup`, `database.restore`, `database.schema`, `database.index`, `database.migrate`.
- `sql.select`, `sql.insert`, `sql.update`, `sql.delete`.
- `cache.get`, `cache.set`, `cache.delete`, `cache.clear`.
- `queue.publish`, `queue.consume`, `queue.retry`, `queue.deadletter`, `queue.metrics`.

### ⏱️ Scheduling & Control Flow
- `scheduler.once`, `scheduler.cron`, `scheduler.interval`, `scheduler.pause`, `scheduler.resume`.
- `automation.trigger`, `automation.conditions`, `automation.loop`, `automation.retry`, `automation.approval_gate`.

### 👁️ Perception & Multimodal Processing
- `ocr.image`, `ocr.pdf`, `ocr.table`, `ocr.handwriting`, `ocr.translate`.
- `vision.detect_objects`, `vision.classify`, `vision.faces`, `vision.barcode`, `vision.qrcode`.
- `audio.transcribe`, `audio.translate`, `audio.summarize`, `audio.clean`, `audio.split`.
- `video.trim`, `video.merge`, `video.subtitle`, `video.thumbnail`, `video.compress`.
- `image.resize`, `image.crop`, `image.rotate`, `image.background_remove`, `image.watermark`, `image.compress`, `image.convert`, `image.metadata`, `image.optimize`, `image.upscale`.

### 🔐 Security, Cryptography & OS Telemetry
- `archive.zip`, `archive.unzip`, `archive.tar`, `archive.extract`, `archive.list`.
- `crypto.encrypt`, `crypto.decrypt`, `crypto.hash`, `crypto.sign`, `crypto.verify`.
- `notify.desktop`, `notify.mobile`, `notify.push`, `notify.webhook`, `notify.browser`.
- `backup.create`, `backup.restore`, `backup.schedule`, `backup.verify`, `backup.cleanup`.
- `logs.search`, `logs.export`, `logs.filter`, `logs.archive`, `logs.stream`.
- `monitor.cpu`, `monitor.memory`, `monitor.disk`, `monitor.network`, `monitor.process`.

### 💻 Developer & Container Automation
- `terminal.exec`, `terminal.script`, `terminal.env`, `terminal.process`, `terminal.kill`.
- `git.clone`, `git.commit`, `git.push`, `git.pull`, `git.branch`.
- `docker.build`, `docker.run`, `docker.stop`, `docker.logs`, `docker.images`.
- `k8s.deploy`, `k8s.scale`, `k8s.logs`, `k8s.pods`, `k8s.services`.
- `pdf.merge`, `pdf.split`, `pdf.compress`, `pdf.sign`, `pdf.protect`.
- `search.local`, `search.semantic`, `search.hybrid`, `search.web`, `search.vector`.

---

## 3. The Power of Composition: Universal DAG Execution

Because every action is an atomic, typed **Skill ABI**, the Planner can satisfy complex real-world workflows without domain-specific code.

### Example: Automated Multi-Channel Invoice Processing & Slack/CRM Sync

```text
webhook.listen (Incoming Invoice Webhook)
        │
        ▼
   ocr.pdf (Extract Structured Data)
        │
        ▼
   json.parse (Parse Metadata)
        │
        ├────────────────────────┐
        ▼                        ▼
  database.insert         crypto.hash (Verify Payload Hash)
        │                        │
        ▼                        ▼
  crm.customer_update     notify.desktop (OS Toast Notification)
        │                        │
        └────────────┬───────────┘
                     ▼
           email.send / notify.push
```
