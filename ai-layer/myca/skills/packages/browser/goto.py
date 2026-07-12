from myca.skills.core.decorator import skill
from .runtime import BrowserRuntime

@skill(
    id="browser.goto",
    version="1.0.0",
    permissions=["browser", "network"],
    inputs=["url"],
    outputs=["status"]
)
async def goto(ctx, url: str) -> dict:
    ctx.emit("browser.goto.started", {"url": url})
    await ctx.check_cancel()
    
    runtime = await BrowserRuntime.get()
    page = await runtime.get_page()
    
    if page:
        ctx.progress(0.5)
        await page.goto(url)
        ctx.progress(1.0)
        return {"status": "success"}
        
    return {"status": "failed", "reason": "Browser not available"}
