"""
MYCA RSS / Atom Feed Reader Skill Package
Parses RSS/Atom XML feeds using standard Python library xml.etree.ElementTree and httpx.
Zero external pip dependencies required.
"""
import logging
import xml.etree.ElementTree as ET
import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.rss_reader")

class RSSReadInputs(BaseModel):
    feed_url: str = Field(description="URL of the RSS or Atom XML feed")
    limit: int = Field(default=10, description="Maximum number of items/posts to retrieve")

class RSSItem(BaseModel):
    title: str
    link: str
    published: str
    summary: str

class RSSReadOutputs(BaseModel):
    feed_url: str
    feed_title: str
    items_count: int
    items_summary: str

@skill(
    id="rss.read",
    name="RSS / Atom Feed Reader",
    description="Reads and parses recent posts/updates from an RSS or Atom XML feed URL.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=RSSReadInputs,
    outputs=RSSReadOutputs
)
async def read_rss_feed(ctx, feed_url: str, limit: int = 10) -> SkillResult:
    logger.info(f"[RSS_READER] Fetching feed from {feed_url}")
    
    headers = {"User-Agent": "MYCA-Agent-OS (RSS Reader)"}
    
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(feed_url, headers=headers)
            if resp.status_code != 200:
                return SkillResult(success=False, logs=[f"HTTP {resp.status_code} while fetching RSS feed: {feed_url}"])
            
            xml_text = resp.text
    except Exception as e:
        logger.error(f"[RSS_READER] Failed to fetch feed {feed_url}: {e}")
        return SkillResult(success=False, logs=[f"Error requesting RSS feed: {str(e)}"])

    # Parse XML
    try:
        root = ET.fromstring(xml_text)
    except Exception as e:
        return SkillResult(success=False, logs=[f"Invalid RSS/Atom XML from {feed_url}: {str(e)}"])

    feed_title = "RSS Feed"
    parsed_items = []

    # Handle RSS 2.0 (<rss><channel><item>...)
    channel = root.find("channel")
    if channel is not None:
        title_el = channel.find("title")
        if title_el is not None and title_el.text:
            feed_title = title_el.text.strip()
        
        for item in channel.findall("item")[:limit]:
            t = item.find("title")
            l = item.find("link")
            p = item.find("pubDate")
            d = item.find("description")
            
            parsed_items.append({
                "title": t.text.strip() if t is not None and t.text else "No Title",
                "link": l.text.strip() if l is not None and l.text else "",
                "published": p.text.strip() if p is not None and p.text else "",
                "summary": d.text.strip()[:300] if d is not None and d.text else ""
            })
    else:
        # Handle Atom (<feed><entry>...)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        # Try finding title with or without namespace
        title_el = root.find("title") or root.find("atom:title", ns)
        if title_el is not None and title_el.text:
            feed_title = title_el.text.strip()
        
        entries = root.findall("entry") or root.findall("atom:entry", ns)
        for entry in entries[:limit]:
            t = entry.find("title") or entry.find("atom:title", ns)
            l = entry.find("link") or entry.find("atom:link", ns)
            p = entry.find("updated") or entry.find("atom:updated", ns) or entry.find("published") or entry.find("atom:published", ns)
            s = entry.find("summary") or entry.find("atom:summary", ns) or entry.find("content") or entry.find("atom:content", ns)
            
            link_href = ""
            if l is not None:
                link_href = l.attrib.get("href", l.text or "")
                
            parsed_items.append({
                "title": t.text.strip() if t is not None and t.text else "No Title",
                "link": link_href,
                "published": p.text.strip() if p is not None and p.text else "",
                "summary": s.text.strip()[:300] if s is not None and s.text else ""
            })

    # Build markdown summary of items
    summary_lines = [f"# {feed_title}\n"]
    for idx, item in enumerate(parsed_items, start=1):
        summary_lines.append(f"### {idx}. {item['title']}")
        if item['link']:
            summary_lines.append(f"**Link:** {item['link']}")
        if item['published']:
            summary_lines.append(f"**Published:** {item['published']}")
        if item['summary']:
            summary_lines.append(f"**Summary:** {item['summary']}")
        summary_lines.append("")

    formatted_summary = "\n".join(summary_lines)

    return SkillResult(
        success=True,
        outputs={
            "feed_url": feed_url,
            "feed_title": feed_title,
            "items_count": len(parsed_items),
            "items_summary": formatted_summary
        },
        logs=[f"Successfully parsed {len(parsed_items)} feed items from '{feed_title}' ({feed_url})"]
    )
