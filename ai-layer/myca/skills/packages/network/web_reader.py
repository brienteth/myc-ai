"""
MYCA Web Reader Skill Package
Converts any URL into clean, LLM-ready Markdown using Jina Reader (r.jina.ai) or HTTP fallback.
Zero external API key or heavy dependency required.
"""
import logging
import re
import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.web_reader")

class WebReadInputs(BaseModel):
    url: str = Field(description="URL of the webpage to read and extract content from")
    raw_html: bool = Field(default=False, description="If True, return raw HTML instead of Markdown")
    timeout_seconds: float = Field(default=15.0, description="HTTP request timeout in seconds")

class WebReadOutputs(BaseModel):
    url: str = Field(description="Target URL")
    title: str = Field(description="Page title or header")
    markdown_content: str = Field(description="Extracted page content in Markdown format")
    status_code: int = Field(description="HTTP status code")
    via_jina: bool = Field(description="Whether content was fetched via Jina Reader")

def _clean_html_to_markdown(html_text: str) -> str:
    """Basic fallback converter from HTML to Markdown when Jina is unavailable."""
    # Strip script and style tags
    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html_text, flags=re.DOTALL | re.IGNORECASE)
    # Convert headings
    text = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', r'\n\n### \1\n', text, flags=re.IGNORECASE)
    # Convert paragraphs & breaks
    text = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\n\1\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<br\s*/?>', r'\n', text, flags=re.IGNORECASE)
    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Clean whitespace
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()

@skill(
    id="web.read",
    name="Web Page Reader",
    description="Reads and extracts full readable Markdown text from any public webpage or URL.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=WebReadInputs,
    outputs=WebReadOutputs
)
async def read_web_page(ctx, url: str, raw_html: bool = False, timeout_seconds: float = 15.0) -> SkillResult:
    logger.info(f"[WEB_READER] Fetching content for URL: {url}")
    
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # Attempt 1: Jina Reader (r.jina.ai)
    jina_url = f"https://r.jina.ai/{url}"
    via_jina = False
    markdown_content = ""
    status_code = 200
    title = ""

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
            resp = await client.get(jina_url, headers=headers)
            if resp.status_code == 200 and resp.text:
                markdown_content = resp.text
                via_jina = True
                status_code = resp.status_code
                first_lines = markdown_content.splitlines()[:5]
                for line in first_lines:
                    if line.startswith("Title:"):
                        title = line.replace("Title:", "").strip()
                        break
    except Exception as e:
        logger.warning(f"[WEB_READER] Jina Reader fetch failed for {url}: {e}. Falling back to direct HTTP.")

    # Attempt 2: Direct HTTP GET Fallback
    if not markdown_content:
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                status_code = resp.status_code
                if raw_html:
                    markdown_content = resp.text
                else:
                    markdown_content = _clean_html_to_markdown(resp.text)
                
                title_match = re.search(r'<title>(.*?)</title>', resp.text, re.IGNORECASE)
                if title_match:
                    title = title_match.group(1).strip()
        except Exception as e:
            logger.error(f"[WEB_READER] Direct HTTP fetch failed for {url}: {e}")
            return SkillResult(
                success=False,
                logs=[f"Failed to fetch webpage at {url}: {str(e)}"]
            )

    if not title:
        title = url

    return SkillResult(
        success=True,
        outputs={
            "url": url,
            "title": title,
            "markdown_content": markdown_content[:20000],
            "status_code": status_code,
            "via_jina": via_jina
        },
        logs=[f"Successfully read webpage '{title}' ({len(markdown_content)} chars, via_jina={via_jina})"]
    )
