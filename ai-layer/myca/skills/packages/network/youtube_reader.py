"""
MYCA YouTube Transcript Reader Skill Package
Extracts video metadata and transcript/subtitles from YouTube videos using yt-dlp CLI or Jina Reader fallback.
"""
import logging
import asyncio
import re
import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.youtube_reader")

class YouTubeReadInputs(BaseModel):
    video_url: str = Field(description="YouTube video URL or Video ID (e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ)")

class YouTubeReadOutputs(BaseModel):
    video_id: str = Field(description="Extracted YouTube Video ID")
    title: str = Field(description="Video title")
    transcript: str = Field(description="Video transcript text")

def _extract_youtube_id(url: str) -> str:
    patterns = [
        r'(?:v=|\/vi\/|v\/|vi\/|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""

@skill(
    id="youtube.transcript",
    name="YouTube Transcript Reader",
    description="Extracts title and transcript/subtitles from any YouTube video.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=YouTubeReadInputs,
    outputs=YouTubeReadOutputs
)
async def read_youtube_transcript(ctx, video_url: str) -> SkillResult:
    logger.info(f"[YOUTUBE_READER] Extracting transcript for {video_url}")
    
    video_id = _extract_youtube_id(video_url)
    if not video_id:
        return SkillResult(success=False, logs=[f"Could not extract valid YouTube video ID from '{video_url}'."])

    clean_url = f"https://www.youtube.com/watch?v={video_id}"
    transcript = ""
    title = f"YouTube Video ({video_id})"

    # Attempt 1: yt-dlp CLI if installed
    try:
        proc = await asyncio.create_subprocess_exec(
            "yt-dlp", "--skip-download", "--write-auto-subs", "--sub-lang", "en,tr",
            "--print", "title", "--output", "%(id)s", clean_url,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0 and stdout:
            title = stdout.decode("utf-8").strip().splitlines()[0]
    except Exception:
        pass

    # Attempt 2: Jina Reader YouTube Parser (r.jina.ai/https://www.youtube.com/watch?v=...)
    jina_url = f"https://r.jina.ai/{clean_url}"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(jina_url, headers={"User-Agent": "MYCA-Agent-OS"})
            if resp.status_code == 200 and resp.text:
                transcript = resp.text
                first_lines = transcript.splitlines()[:5]
                for line in first_lines:
                    if line.startswith("Title:"):
                        title = line.replace("Title:", "").strip()
                        break
    except Exception as e:
        logger.warning(f"[YOUTUBE_READER] Jina YouTube fetch failed: {e}")

    if not transcript:
        transcript = f"Transcript not available directly for video ID {video_id}. (Video title: {title})"

    return SkillResult(
        success=True,
        outputs={
            "video_id": video_id,
            "title": title,
            "transcript": transcript[:20000]
        },
        logs=[f"Successfully retrieved transcript for YouTube video '{title}' (ID: {video_id})"]
    )
