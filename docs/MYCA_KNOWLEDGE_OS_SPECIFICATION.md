# MYCA KNOWLEDGE OS — SPECIFICATION & ARCHITECTURE

> **Core Philosophy:**
> **Knowledge OS = Execution Engine's Active Knowledge Operating System.**
> It is NOT a cloud storage manager (Dropbox/Drive) nor a passive RAG note app (Notion).
> Its singular purpose is to convert raw human knowledge into an active, execution-ready system that fuels the Execution Engine:
> **Import $\rightarrow$ Understand $\rightarrow$ Index $\rightarrow$ Link $\rightarrow$ Retrieve $\rightarrow$ Execute**.

---

## 🔄 1. The Knowledge-to-Execution Pipeline

```text
  Raw Document / File / Web Capture
                 │
                 ▼
          1. Parse Service (Type Detection & Normalization)
                 │
                 ▼
          2. OCR & Vision Service (Images, PDF, Video Transcripts)
                 │
                 ▼
          3. Chunking Engine (Semantic Boundary Splitting)
                 │
                 ▼
          4. Embedding Engine (Vector Representations)
                 │
                 ▼
          5. Knowledge Index (Hybrid Semantic + Keyword Index)
                 │
                 ▼
          6. Relationship Builder & Knowledge Graph (Entity/Invoice/Client Links)
                 │
                 ▼
          7. Execution Knowledge & Experience Linker (Planner ABI & Past DAG Success Rates)
                 │
                 ▼
        Planner & Runtime Engine (Autonomous Need Execution)
```

---

## 📐 2. User Interface Layout Breakdown

### 1) Top Header Bar
- **Title & Tagline**: `Knowledge OS` — *Everything Myca knows.*
- **Action Buttons**: `+ Import` (Wizard), `⚡ Capture` (Web/Clipboard), `📁 New Collection`, `🔄 Sync`, `⚙️ Settings`.

### 2) Massive Hybrid Search Area
- **Placeholder**: `Search everything... files, knowledge, people, functions, emails, code, images, memories, artifacts...`
- **Search Modes**: `Hybrid`, `Semantic`, `Keyword`, `Graph`, `Metadata`, `Regex`.
- **Search Output Categories**: Files, Chunks, People, Projects, Workflows, Artifacts, Skills, Experience, Memory.

### 3) Quick Action Cards
- `Import Files` | `Import Folder` | `Connect Drive` | `Scan Desktop` | `Capture Webpage` | `Capture Clipboard` | `New Note` | `New Collection`.

### 4) Three-Column Workspace Layout
- **Left Sidebar**:
  - **Collections**: Colored folders (Finance, Invoices, Personal, Research, Projects, Work, Clients, Legal, Books, Images).
  - **Knowledge Types**: Documents (PDF, DOCX, TXT, MD, HTML, CSV, XLSX, PPTX), Research Reports, Images & OCR, Code Snippets & Repositories, Audio & Video Transcripts, Planner Memory (Working & Long-Term), Experience (DAG Run Logs), Templates.
- **Center — Knowledge Explorer**:
  - Grid (`□ □ □`) / List (`≡`) / Knowledge Graph (`🕸️`) view toggle.
  - Cards show Icon, Title, Summary, Tags, Owner, Updated Date, Vector Score, and Quick Hover Actions (`Preview`, `Run`, `Open`, `Related`).
- **Right Panel — Preview & Execution Panel**:
  - Tabbed views: `[Preview]` (Interactive PDF/Syntax Highlight/OCR/Audio), `[Summary]` (LLM Topics & Entities), `[Metadata]`, `[Knowledge]` (Chunks & Vector IDs), `[Relationships]` (Interactive Graph), `[Execution]` (Suggested Executable Workflows), `[History]`.
  - Prominent **`⚡ Run Execution Engine Workflow`** button on every item.

### 5) Bottom Fixed Bar — Background Services & Queues
- **Queue Statuses**: `Import Queue`, `Embedding Queue`, `OCR Queue`, `Parser Queue`, `Knowledge Queue` (`Queued` | `Running` | `Completed` | `Failed`).
- **Ask Knowledge Input Bar**: Natural language query input connected directly to the Planner & Runtime (`Ask Knowledge` $\to$ `Planner` $\to$ `Workflow` $\to$ `Result`).

---

## ⚙️ 3. Underlying OS Background Services

1. **Parser Service:** Detects file types (PDF, DOCX, TXT, MD, HTML, CSV, XLSX, PPTX, Source Code) and normalizes input text.
2. **OCR & Vision Service:** Extracts text from scanned documents, screenshots, and video frames using local OCR models.
3. **Chunking Engine:** Splits long-form documents into semantic chunks respecting structural boundaries.
4. **Embedding Engine:** Generates vector embeddings for every chunk.
5. **Knowledge Index:** Maintains hybrid vector + keyword inverted index.
6. **Relationship Builder & Knowledge Graph:** Extracts entities (People, Invoices, Clients, Projects, Code Functions) and builds clickable node graphs.
7. **Execution Knowledge Service:** Indexes skill ABIs, API specs, and execution templates for the Planner.
8. **Experience Linker:** Connects documents to past workflow runs, tracking execution latency, energy, and success rates.
