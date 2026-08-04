# Myca Python SDK Documentation

The **Myca Python SDK** (`myca`) allows you to embed Myca's local-first AI engine, web scraper, session memory, and autonomous software factory directly into any Python application.

It operates in three flexibile deployment modes:
1. **In-Process Local Execution (`backend="llamacpp"`)**: Runs LLM inference directly in Python using GGUF models via `llama-cpp-python` (Metal/CUDA accelerated).
2. **Local Mock Execution (`backend="mock"`)**: Lightweight test mode for development without GPU or model file requirements.
3. **Remote Node Connection (`backend="remote"`)**: Connects over HTTP to a running Myca node or daemon.

---

## 🛠️ Installation

```bash
# Core SDK client + remote HTTP connection
pip install myca

# SDK + in-process LLM inference (llama-cpp-python)
pip install "myca[local]"

# Full installation (Local LLM + Web Crawler + Fast API Server + P2P Mesh)
pip install "myca[all]"
```

---

## 🚀 Quickstart

```python
import asyncio
from myca import Myca

async def main():
    async with Myca() as ai:
        # LLM Generation
        response = await ai.generate("Explain quantum computing in 2 sentences.")
        print(response)

        # Web Scraping to Clean Markdown
        page = await ai.scrape("https://example.com")
        print(f"Title: {page['title']}\n{page['markdown']}")

if __name__ == "__main__":
    asyncio.run(main())
```

### One-Shot Synchronous Helpers

For quick non-async scripts:

```python
from myca import generate, scrape

text = generate("What is Python?")
page = scrape("https://example.com")
```

---

## 📖 Complete API Reference

### `Myca` Client Class

```python
Myca(
    backend: str = "auto",       # "auto", "llamacpp", "mock", "remote"
    model_path: str = None,      # Path to GGUF model file
    remote_url: str = None,      # URL of remote Myca node (default: http://localhost:8420)
    gpu_layers: int = -1,        # GPU offload layers (-1 for max offload)
    ctx_size: int = 4096,        # Context window size
    system_prompt: str = None,   # Default system prompt
    data_dir: str = "~/.myca",   # Data & database path
    verbose: bool = False        # Enable verbose logs
)
```

---

### 1. LLM Generation & Inference

#### `generate(prompt, system_prompt=None, temperature=0.7, max_tokens=2048) -> str`
Generates a complete text response asynchronously.

```python
result = await ai.generate(
    "Write a short essay on renewable energy.",
    system_prompt="You are a climate science expert.",
    temperature=0.3
)
```

#### `stream(prompt, system_prompt=None, temperature=0.7, max_tokens=2048) -> AsyncGenerator[str, None]`
Streams text token-by-token.

```python
async for token in ai.stream("Write a poem about space:"):
    print(token, end="", flush=True)
```

#### `chat(messages, temperature=0.7, max_tokens=2048) -> str`
OpenAI-compatible chat completion interface.

```python
messages = [
    {"role": "system", "content": "You are a helpful coding assistant."},
    {"role": "user", "content": "How do I parse JSON in Python?"}
]
response = await ai.chat(messages)
```

#### `embed(text) -> List[float]` & `embed_batch(texts) -> List[List[float]]`
Generates dense vector embeddings.

```python
vector = await ai.embed("Vector databases are useful for semantic search.")
```

#### `classify(text, labels) -> Dict[str, float]`
Classifies text against candidate labels.

```python
probs = await ai.classify(
    "My order hasn't arrived yet!",
    labels=["support", "sales", "billing", "shipping"]
)
```

---

### 2. Local Web Crawler (Firecrawl-Inspired)

Scrapes websites and extracts clean, LLM-ready Markdown or structured JSON locally—no external API keys or cloud services required.

#### `scrape(url, only_main_content=True) -> dict`
Scrapes a single URL to Markdown.

```python
result = await ai.scrape("https://example.com/article")
# Result fields:
# {
#   "url": "https://example.com/article",
#   "title": "Article Title",
#   "markdown": "# Article Title\n\nContent...",
#   "metadata": {"description": "...", "og_title": "..."},
#   "word_count": 450,
#   "scraped_at": 1720000000.0
# }
```

#### `crawl(url, max_pages=10) -> List[dict]`
Crawls a website following internal domain links up to `max_pages`.

```python
pages = await ai.crawl("https://docs.example.com", max_pages=5)
for page in pages:
    print(page["url"], page["word_count"])
```

#### `extract(url, schema=None) -> dict`
Extracts structured JSON data matching a Pydantic/JSON schema from a URL using LLM analysis.

```python
schema = {
    "product_name": "string",
    "price": "number",
    "in_stock": "boolean"
}
data = await ai.extract("https://store.example.com/item/1", schema=schema)
print(data["structured_data"])
```

---

### 3. Second Brain & Session Memory (Obsidian-Inspired)

Local-first knowledge vault with session context preservation (`handover` / `resume`), markdown note indexing, and semantic wikilink auto-linking.

#### `handover(summary, decisions=None, next_steps=None, open_questions=None, context_files=None) -> dict`
Saves a snapshot of current session context (written to `~/.myca/notes/handovers/` and SQLite).

```python
handover = await ai.handover(
    summary="Completed authentication module refactoring",
    decisions=["Migrated from JWT cookies to Bearer tokens"],
    next_steps=["Write integration tests", "Update OpenAPI spec"],
    context_files=["auth.py", "database.py"]
)
```

#### `resume(handover_id=None) -> dict`
Loads the latest (or specific) session handover to resume work.

```python
prev_context = await ai.resume()
print(f"Resuming work from: {prev_context['summary']}")
print("Pending tasks:", prev_context['next_steps'])
```

#### `ingest(url) -> dict`
Scrapes a URL and saves it directly into the knowledge vault (`~/.myca/notes/scrapes/`) with frontmatter metadata.

```python
note = await ai.ingest("https://news.ycombinator.com/item?id=12345")
```

#### `vault_search(query, limit=20) -> List[dict]` & `vault_autolink() -> dict`
Searches indexed notes and automatically builds `[[wikilinks]]` connections between related notes.

```python
notes = await ai.vault_search("authentication")
link_result = await ai.vault_autolink()
```

---

### 4. Autonomous Software Factory (Finn-loop-Inspired)

3-phase autonomous development loop (**Spec → Build → Review**) running 100% offline with local Git and SQLite state tracking.

```python
# 1. Generate Acceptance Criteria (AC) & Non-Goals (NG) from user request
spec = await ai.factory_spec(
    prompt="Add dark mode toggle to user settings page",
    repo_path="~/projects/my-app"
)

# 2. Implement spec on isolated branch ('factory/spec-id')
build = await ai.factory_build(spec["id"])

# 3. Review code changes against criteria (verdict: LOOP_APPROVED | LOOP_CHANGES_REQUESTED | NEEDS_HUMAN_REVIEW)
review = await ai.factory_review(spec["id"])

# Or run full autonomous cycle in one command:
loop_result = await ai.factory_loop(repo_path="~/projects/my-app")
```

---

## 🌐 REST API Endpoints Reference

When running `myca` as a server daemon (`python -m myca.api` or `myca`), the following endpoints are available:

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **LLM** | `/query` | `POST` | Execute prompt generation/streaming |
| **OpenAI** | `/v1/chat/completions` | `POST` | OpenAI-compatible chat endpoint |
| **OpenAI** | `/v1/models` | `GET` | List available LLM models |
| **Crawler** | `/automation/crawler/scrape` | `POST` | Scrape URL to clean Markdown |
| **Crawler** | `/automation/crawler/crawl` | `POST` | Crawl website up to N pages |
| **Crawler** | `/automation/crawler/extract` | `POST` | Extract structured JSON from URL |
| **Brain** | `/automation/brain/handover` | `POST` | Save session context snapshot |
| **Brain** | `/automation/brain/resume` | `GET` | Load latest session context |
| **Brain** | `/automation/brain/search` | `POST` | Search knowledge vault notes |
| **Brain** | `/automation/brain/ingest` | `POST` | Scrape URL and ingest into vault |
| **Factory** | `/automation/factory/spec` | `POST` | Create software specification |
| **Factory** | `/automation/factory/build` | `POST` | Trigger implementation build |
| **Factory** | `/automation/factory/review` | `POST` | Review code changes against spec |
| **Factory** | `/automation/factory/loop` | `POST` | Trigger autonomous factory cycle |

---

## 💡 Example Integration Scenarios

### Integrating into a FastAPI Web App
```python
from fastapi import FastAPI
from myca import Myca

app = FastAPI()
ai = Myca(backend="auto")

@app.on_event("startup")
async def startup():
    await ai.initialize()

@app.on_event("shutdown")
async def shutdown():
    await ai.shutdown()

@app.post("/summarize-url")
async def summarize_url(url: str):
    page = await ai.scrape(url)
    summary = await ai.generate(f"Summarize this content:\n{page['markdown'][:3000]}")
    return {"title": page["title"], "summary": summary}
```

### Integrating into a CLI Tool
```python
import sys
from myca import generate, scrape

if len(sys.argv) > 1:
    url = sys.argv[1]
    page = scrape(url)
    print(f"--- {page['title']} ---")
    print(page["markdown"][:1000])
```
