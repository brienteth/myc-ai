"""
Tests for the Local Web Crawler & Markdown Engine.

Covers:
  - HTML to Markdown conversion (minimal converter)
  - Metadata extraction
  - HTML cleaning
  - Scraping (mocked HTTP)
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest


SAMPLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <title>Test Page — Example</title>
    <meta name="description" content="A test page for scraping">
    <meta property="og:title" content="OG Test Page">
    <meta property="og:description" content="OG description here">
    <script>var x = 1;</script>
    <style>body { color: red; }</style>
</head>
<body>
    <nav><a href="/home">Home</a></nav>
    <main>
        <h1>Welcome to the Test</h1>
        <p>This is a <strong>test paragraph</strong> with <em>emphasis</em>.</p>
        <h2>Section Two</h2>
        <p>Another paragraph with a <a href="https://example.com">link</a>.</p>
        <pre><code>def hello():
    print("world")</code></pre>
        <ul>
            <li>Item one</li>
            <li>Item two</li>
        </ul>
        <blockquote>This is a quote.</blockquote>
    </main>
    <footer>Footer content</footer>
</body>
</html>"""


class TestMinimalHtmlToMarkdown:
    """Tests for the built-in HTML→Markdown converter (no external deps)."""

    def test_headers(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("<h1>Title</h1><h2>Subtitle</h2>")
        assert "# Title" in result
        assert "## Subtitle" in result

    def test_bold_and_italic(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("<strong>bold</strong> and <em>italic</em>")
        assert "**bold**" in result
        assert "*italic*" in result

    def test_links(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert('<a href="https://example.com">Click</a>')
        assert "[Click](https://example.com)" in result

    def test_code_blocks(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("<pre><code>print('hi')</code></pre>")
        assert "```" in result
        assert "print('hi')" in result

    def test_inline_code(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("Use <code>git status</code> command")
        assert "`git status`" in result

    def test_list_items(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("<li>First</li><li>Second</li>")
        assert "- First" in result
        assert "- Second" in result

    def test_strip_scripts_and_styles(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert(
            "<script>alert('xss')</script><p>Safe</p><style>.x{}</style>"
        )
        assert "alert" not in result
        assert "Safe" in result
        assert ".x{}" not in result

    def test_html_entities(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert("&amp; &lt; &gt; &quot;")
        assert "& < > \"" in result

    def test_full_sample(self):
        from myca.automation.crawler import MinimalHtmlToMarkdown
        result = MinimalHtmlToMarkdown.convert(SAMPLE_HTML)
        assert "Welcome to the Test" in result
        assert "test paragraph" in result
        assert "var x = 1" not in result  # Script removed
        assert "color: red" not in result  # Style removed


class TestLocalWebCrawler:
    """Tests for the LocalWebCrawler class."""

    def test_html_to_markdown(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()
        result = crawler.html_to_markdown(SAMPLE_HTML)
        assert "Welcome to the Test" in result
        assert len(result) > 50

    def test_extract_metadata(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()
        meta = crawler._extract_metadata(SAMPLE_HTML, "https://example.com")
        assert meta["url"] == "https://example.com"
        # Title extraction depends on BS4 availability
        assert "scraped_at" in meta

    def test_clean_html_removes_noise(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()
        cleaned = crawler._clean_html(SAMPLE_HTML)
        assert "<script>" not in cleaned
        assert "<style>" not in cleaned

    @pytest.mark.asyncio
    async def test_scrape_url_mocked(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()

        with patch.object(crawler, "_fetch_html", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = SAMPLE_HTML
            result = await crawler.scrape_url("https://example.com")

            assert result["url"] == "https://example.com"
            assert "Welcome to the Test" in result["markdown"]
            assert result["word_count"] > 0
            assert "scraped_at" in result

    @pytest.mark.asyncio
    async def test_search_and_extract_empty_urls(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()
        results = await crawler.search_and_extract("test query")
        assert results == []

    @pytest.mark.asyncio
    async def test_crawl_site_mocked(self):
        from myca.automation.crawler import LocalWebCrawler
        crawler = LocalWebCrawler()

        with patch.object(crawler, "_fetch_html", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = SAMPLE_HTML
            results = await crawler.crawl_site("https://example.com", max_pages=2)

            assert len(results) >= 1
            assert results[0]["url"] == "https://example.com"
