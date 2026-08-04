from myca.skills.core.decorator import skill
from .runtime import BrowserRuntime

@skill(
    id="browser.search",
    version="1.0.0",
    permissions=["browser", "network"],
    inputs=["query"],
    outputs=["results"]
)
async def search(ctx, query: str) -> dict:
    ctx.emit("browser.search.started", {"query": query})
    await ctx.check_cancel()
    
    # Example of COMPOSITION: calling another skill via the OS context
    # Note: execute() will route through the full lifecycle engine
    url = f"https://duckduckgo.com/html/?q={query.replace(' ', '+')}"
    goto_result = await ctx.execute("browser.goto", url=url)
    
    if not goto_result.success:
        return {"error": "Failed to load search engine."}
        
    ctx.progress(0.7)
    await ctx.check_cancel()
    
    # Example of direct execution for extracting text
    runtime = await BrowserRuntime.get()
    page = await runtime.get_page()
    
    results = []
    if page:
        # Simple extraction logic
        elements = await page.query_selector_all(".result__snippet")
        for el in elements:
            text = await el.inner_text()
            results.append(text)
            
    ctx.progress(1.0)
    return {"results": results}
