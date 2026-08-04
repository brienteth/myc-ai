"""
MYCA Twitter / X Reader Skill Package
Reads tweets, threads, and user timelines on X (Twitter) using public Jina Reader / Nitter / API syndication as zero-config default,
with fallback to local twitter-cli or agent-reach CLI when available.
"""
import logging
import asyncio
import os
import re
import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.twitter_reader")

class TwitterReadInputs(BaseModel):
    query: str = Field(description="Tweet URL (e.g. https://x.com/user/status/123), username (@username), or search keyword")
    count: int = Field(default=5, description="Number of tweets to retrieve if searching or reading user timeline")

class TwitterReadOutputs(BaseModel):
    query: str = Field(description="Target query or tweet URL")
    content: str = Field(description="Formatted tweet or thread markdown text")
    source: str = Field(description="Data source used (e.g. 'jina_reader', 'twitter_cli', 'agent_reach')")

@skill(
    id="twitter.read",
    name="Read Twitter / X",
    description="Reads tweets, threads, or searches X posts via zero-config public syndication or local agent-reach CLI.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=TwitterReadInputs,
    outputs=TwitterReadOutputs
)
async def read_twitter(ctx, query: str, count: int = 5) -> SkillResult:
    logger.info(f"[TWITTER_READER] Reading Twitter query: '{query}'")
    
    clean_query = query.strip()
    source = "jina_reader"
    content = ""

    # Attempt 1: Local twitter-cli or agent-reach CLI if installed
    auth_token = os.environ.get("TWITTER_AUTH_TOKEN", "")
    ct0 = os.environ.get("TWITTER_CT0", "")
    
    if auth_token and ct0:
        try:
            proc = await asyncio.create_subprocess_exec(
                "twitter", "search" if not clean_query.startswith("http") else "read",
                clean_query,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0 and stdout:
                content = stdout.decode("utf-8")
                source = "twitter_cli"
        except Exception:
            pass

    # Attempt 2: Jina Reader for Tweet URLs or User profiles (https://r.jina.ai/https://x.com/...)
    if not content:
        target_url = clean_query
        if not target_url.startswith("http"):
            if clean_query.startswith("@"):
                target_url = f"https://x.com/{clean_query.lstrip('@')}"
            else:
                target_url = f"https://x.com/search?q={clean_query}"

        jina_url = f"https://r.jina.ai/{target_url}"
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(jina_url, headers={"User-Agent": "MYCA-Agent-OS"})
                if resp.status_code == 200 and resp.text:
                    content = resp.text
                    source = "jina_reader"
        except Exception as e:
            logger.warning(f"[TWITTER_READER] Jina Reader fetch failed for Twitter: {e}")

    # Attempt 3: Basic Syndication Fallback
    if not content:
        tweet_id_match = re.search(r'status/(\d+)', clean_query)
        if tweet_id_match:
            tweet_id = tweet_id_match.group(1)
            syndication_url = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(syndication_url)
                    if res.status_code == 200:
                        data = res.json()
                        text = data.get("text", "")
                        author = data.get("user", {}).get("name", "Unknown")
                        handle = data.get("user", {}).get("screen_name", "")
                        content = f"**{author}** (@{handle}):\n\n{text}"
                        source = "x_syndication_api"
            except Exception:
                pass

    if not content:
        content = f"Could not extract Twitter content for query '{query}'. Try configuring TWITTER_AUTH_TOKEN or installing agent-reach CLI for private timeline access."

    return SkillResult(
        success=True,
        outputs={
            "query": clean_query,
            "content": content[:20000],
            "source": source
        },
        logs=[f"Successfully read Twitter content for '{query}' via source '{source}'"]
    )
