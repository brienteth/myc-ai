import os
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
from .runtime import BrowserRuntime

from pydantic import BaseModel, Field

class GotoInputs(BaseModel):
    url: str = Field(default="https://google.com", description="Target website URL")

@skill(
    id="browser.goto",
    name="Browser Navigate",
    description="Navigates browser to URL and extracts rendered HTML/text content.",
    version="1.0.0",
    permissions=["browser", "network"],
    inputs_schema=GotoInputs
)
async def goto(ctx, url: str = "https://google.com") -> SkillResult:
    ctx.emit("browser.goto.started", {"url": url})
    await ctx.check_cancel()
    
    try:
        runtime = await BrowserRuntime.get()
        page = await runtime.get_page()
        
        if page:
            ctx.progress(0.5)
            await page.goto(url, timeout=30000)
            title = await page.title()
            content = await page.content()
            ctx.progress(1.0)
            return SkillResult(
                success=True,
                outputs={"status": "success", "content": content, "title": title},
                logs=[f"Successfully navigated to '{url}' (title: {title})"]
            )
    except Exception as e:
        pass

    # Fallback via HTTP fetch if Playwright browser binary isn't available
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, follow_redirects=True)
            return SkillResult(
                success=True,
                outputs={"status": "success", "content": resp.text, "title": url},
                logs=[f"Navigated via HTTP fallback to '{url}'"]
            )
    except Exception as e:
        return SkillResult(success=False, logs=[f"Browser navigation failed: {str(e)}"])
