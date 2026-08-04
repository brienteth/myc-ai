"""
Local Web Crawler & Markdown Engine (Firecrawl-Inspired)

Scrapes web pages and converts them to clean, LLM-ready Markdown or structured JSON.
No external API keys, no Firecrawl subscription — runs 100% locally using
httpx + BeautifulSoup + html2text.
"""

import json
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

logger = logging.getLogger("myca.automation.crawler")

# Optional imports with graceful fallback
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    import html2text
    HAS_HTML2TEXT = True
except ImportError:
    HAS_HTML2TEXT = False


# ── Minimal HTML-to-Markdown (no dependencies needed) ─────────

class MinimalHtmlToMarkdown:
    """
    Converts HTML to clean Markdown without any external libraries.
    Used as a fallback when html2text / BeautifulSoup are not installed.
    """

    # Tags to completely remove (including content)
    STRIP_TAGS = {"script", "style", "noscript", "iframe", "svg", "nav", "footer", "header"}

    @staticmethod
    def convert(html: str) -> str:
        # Remove stripped tags and their content
        for tag in MinimalHtmlToMarkdown.STRIP_TAGS:
            html = re.sub(rf"<{tag}[^>]*>.*?</{tag}>", "", html, flags=re.DOTALL | re.IGNORECASE)

        # Remove HTML comments
        html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)

        # Headers
        for level in range(6, 0, -1):
            html = re.sub(
                rf"<h{level}[^>]*>(.*?)</h{level}>",
                lambda m: f"\n{'#' * level} {m.group(1).strip()}\n",
                html, flags=re.DOTALL | re.IGNORECASE
            )

        # Bold
        html = re.sub(r"<(?:b|strong)[^>]*>(.*?)</(?:b|strong)>", r"**\1**", html, flags=re.DOTALL | re.IGNORECASE)

        # Italic
        html = re.sub(r"<(?:i|em)[^>]*>(.*?)</(?:i|em)>", r"*\1*", html, flags=re.DOTALL | re.IGNORECASE)

        # Code blocks
        html = re.sub(r"<pre[^>]*><code[^>]*>(.*?)</code></pre>", r"\n```\n\1\n```\n", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<pre[^>]*>(.*?)</pre>", r"\n```\n\1\n```\n", html, flags=re.DOTALL | re.IGNORECASE)

        # Inline code
        html = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", html, flags=re.DOTALL | re.IGNORECASE)

        # Links
        html = re.sub(
            r'<a\s+[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>',
            r"[\2](\1)",
            html, flags=re.DOTALL | re.IGNORECASE
        )

        # Images
        html = re.sub(
            r'<img\s+[^>]*src=["\']([^"\']*)["\'][^>]*(?:alt=["\']([^"\']*)["\'])?[^>]*/?>',
            r"![\2](\1)",
            html, flags=re.DOTALL | re.IGNORECASE
        )

        # List items
        html = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", html, flags=re.DOTALL | re.IGNORECASE)

        # Paragraphs and line breaks
        html = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\1\n", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
        html = re.sub(r"<hr\s*/?>", "\n---\n", html, flags=re.IGNORECASE)

        # Blockquotes
        html = re.sub(r"<blockquote[^>]*>(.*?)</blockquote>",
                       lambda m: "\n" + "\n".join(f"> {line}" for line in m.group(1).strip().split("\n")) + "\n",
                       html, flags=re.DOTALL | re.IGNORECASE)

        # Strip remaining HTML tags
        html = re.sub(r"<[^>]+>", "", html)

        # Decode common HTML entities
        html = html.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        html = html.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")

        # Clean up excessive whitespace
        html = re.sub(r"\n{3,}", "\n\n", html)
        html = re.sub(r" {2,}", " ", html)

        return html.strip()


# ── Main Crawler ──────────────────────────────────────────────

class LocalWebCrawler:
    """
    Fetches web pages and converts them to clean Markdown or structured JSON.
    Works entirely locally with Python standard library + optional httpx/bs4.
    """

    DEFAULT_TIMEOUT = 15
    DEFAULT_USER_AGENT = "Myca-LocalCrawler/1.0 (local-first AI; +https://github.com/brienteth/myc-ai)"

    # Tags whose entire content should be removed for clean extraction
    NOISE_TAGS = ["script", "style", "noscript", "iframe", "svg", "nav", "footer",
                  "aside", "form", "button", "input", "select", "textarea"]

    def __init__(self, timeout: int = DEFAULT_TIMEOUT, user_agent: str = DEFAULT_USER_AGENT):
        self.timeout = timeout
        self.user_agent = user_agent

    # ── Core: Fetch HTML ───────────────────────────────────────

    async def _fetch_html(self, url: str) -> str:
        """Fetch raw HTML from URL. Uses httpx (async) if available, else urllib."""
        headers = {"User-Agent": self.user_agent}

        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.text
        else:
            # Fallback to synchronous urllib
            import urllib.request
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")

    # ── Clean HTML ─────────────────────────────────────────────

    def _clean_html(self, html: str, only_main_content: bool = True) -> str:
        """Remove noise tags and optionally extract only main content."""
        if HAS_BS4:
            soup = BeautifulSoup(html, "html.parser")

            # Remove noise tags
            for tag_name in self.NOISE_TAGS:
                for tag in soup.find_all(tag_name):
                    tag.decompose()

            # Try to extract main content
            if only_main_content:
                main = (soup.find("main") or soup.find("article") or
                        soup.find(attrs={"role": "main"}) or
                        soup.find(id=re.compile(r"content|main|article", re.I)) or
                        soup.find(class_=re.compile(r"content|main|article|post", re.I)))
                if main:
                    return str(main)

            body = soup.find("body")
            return str(body) if body else str(soup)
        else:
            # Regex-based cleaning without BS4
            for tag in self.NOISE_TAGS:
                html = re.sub(rf"<{tag}[^>]*>.*?</{tag}>", "", html, flags=re.DOTALL | re.IGNORECASE)
            return html

    # ── HTML → Markdown ────────────────────────────────────────

    def html_to_markdown(self, html: str, only_main_content: bool = True) -> str:
        """
        Convert HTML to clean, LLM-ready Markdown.
        Uses html2text if available, otherwise falls back to built-in converter.
        """
        cleaned = self._clean_html(html, only_main_content)

        if HAS_HTML2TEXT:
            converter = html2text.HTML2Text()
            converter.ignore_links = False
            converter.ignore_images = False
            converter.ignore_emphasis = False
            converter.body_width = 0  # No wrapping
            converter.skip_internal_links = True
            converter.single_line_break = True
            return converter.handle(cleaned).strip()
        else:
            return MinimalHtmlToMarkdown.convert(cleaned)

    # ── Extract Metadata ───────────────────────────────────────

    def _extract_metadata(self, html: str, url: str) -> dict:
        """Extract page title, description, and Open Graph metadata."""
        meta = {"url": url, "scraped_at": time.time()}

        if HAS_BS4:
            soup = BeautifulSoup(html, "html.parser")

            # Title
            title_tag = soup.find("title")
            meta["title"] = title_tag.get_text(strip=True) if title_tag else ""

            # Meta description
            desc_tag = soup.find("meta", attrs={"name": "description"})
            if desc_tag:
                meta["description"] = desc_tag.get("content", "")

            # OG tags
            for og_prop in ["og:title", "og:description", "og:image", "og:type", "og:site_name"]:
                og_tag = soup.find("meta", attrs={"property": og_prop})
                if og_tag:
                    key = og_prop.replace("og:", "og_")
                    meta[key] = og_tag.get("content", "")

            # Language
            html_tag = soup.find("html")
            if html_tag and html_tag.get("lang"):
                meta["language"] = html_tag["lang"]

        else:
            # Regex fallback
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
            meta["title"] = title_match.group(1).strip() if title_match else ""

            desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)', html, re.IGNORECASE)
            if desc_match:
                meta["description"] = desc_match.group(1)

        return meta

    # ── Public API ─────────────────────────────────────────────

    async def scrape_url(self, url: str, only_main_content: bool = True) -> dict:
        """
        Scrape a URL and return clean Markdown + metadata.

        Returns:
            {
                "url": str,
                "title": str,
                "markdown": str,
                "metadata": {...},
                "word_count": int,
                "scraped_at": float
            }
        """
        logger.info(f"[CRAWLER] Scraping: {url}")
        html = await self._fetch_html(url)
        metadata = self._extract_metadata(html, url)
        markdown = self.html_to_markdown(html, only_main_content)

        word_count = len(markdown.split())

        result = {
            "url": url,
            "title": metadata.get("title", ""),
            "markdown": markdown,
            "metadata": metadata,
            "word_count": word_count,
            "scraped_at": time.time()
        }
        logger.info(f"[CRAWLER] Done: {url} ({word_count} words)")
        return result

    async def extract_structured_data(self, url: str, schema: Optional[dict] = None,
                                       inference_engine=None) -> dict:
        """
        Extract structured JSON data from a URL using optional LLM parsing.

        If inference_engine is provided, uses LLM to extract data matching the schema.
        Otherwise returns basic metadata + raw markdown.
        """
        scrape_result = await self.scrape_url(url)
        markdown = scrape_result["markdown"]

        if inference_engine and schema:
            system_prompt = f"""Extract the following structured data from the provided text.
Output ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}

If a field cannot be found, use null."""

            try:
                raw = await inference_engine.generate(
                    f"Text to extract from:\n{markdown[:4000]}",
                    system_prompt=system_prompt
                )
                raw = raw.strip()
                if raw.startswith("```"):
                    lines = raw.splitlines()
                    lines = [l for l in lines if not l.startswith("```")]
                    raw = "\n".join(lines).strip()
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1:
                    raw = raw[start:end + 1]
                extracted = json.loads(raw)
                scrape_result["structured_data"] = extracted
            except Exception as e:
                logger.warning(f"Structured extraction failed: {e}")
                scrape_result["structured_data"] = None
        else:
            scrape_result["structured_data"] = None

        return scrape_result

    async def search_and_extract(self, query: str, urls: Optional[List[str]] = None,
                                  limit: int = 5) -> List[dict]:
        """
        Scrape multiple URLs and extract content relevant to a query.
        If no URLs are provided, returns an empty list (no external search API needed).
        """
        if not urls:
            return []

        results = []
        for url in urls[:limit]:
            try:
                result = await self.scrape_url(url)
                results.append(result)
            except Exception as e:
                logger.warning(f"[CRAWLER] Failed to scrape {url}: {e}")
                results.append({"url": url, "error": str(e)})

        return results

    async def crawl_site(self, start_url: str, max_pages: int = 10,
                          only_main_content: bool = True) -> List[dict]:
        """
        Crawl a website starting from start_url, following internal links.
        Returns a list of scraped pages (capped at max_pages).
        """
        visited = set()
        to_visit = [start_url]
        results = []
        base_domain = urlparse(start_url).netloc

        while to_visit and len(results) < max_pages:
            url = to_visit.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                html = await self._fetch_html(url)
                metadata = self._extract_metadata(html, url)
                markdown = self.html_to_markdown(html, only_main_content)

                results.append({
                    "url": url,
                    "title": metadata.get("title", ""),
                    "markdown": markdown,
                    "metadata": metadata,
                    "word_count": len(markdown.split()),
                    "scraped_at": time.time()
                })

                # Extract internal links
                if HAS_BS4:
                    soup = BeautifulSoup(html, "html.parser")
                    for a in soup.find_all("a", href=True):
                        href = urljoin(url, a["href"])
                        parsed = urlparse(href)
                        if parsed.netloc == base_domain and href not in visited:
                            to_visit.append(href.split("#")[0].split("?")[0])
                else:
                    for match in re.finditer(r'href=["\']([^"\']*)["\']', html):
                        href = urljoin(url, match.group(1))
                        parsed = urlparse(href)
                        if parsed.netloc == base_domain and href not in visited:
                            to_visit.append(href.split("#")[0].split("?")[0])

            except Exception as e:
                logger.warning(f"[CRAWLER] Failed to crawl {url}: {e}")

        logger.info(f"[CRAWLER] Crawled {len(results)} pages from {start_url}")
        return results
