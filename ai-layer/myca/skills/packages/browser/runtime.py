"""
Browser Runtime (Singleton)
Provides a persistent Playwright context for all browser skills.
"""
import logging

logger = logging.getLogger("myca.skills.browser.runtime")

class BrowserRuntime:
    _instance = None
    
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        
    @classmethod
    async def get(cls) -> "BrowserRuntime":
        if cls._instance is None:
            cls._instance = BrowserRuntime()
            await cls._instance.start()
        return cls._instance
        
    async def start(self):
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed.")
            return
            
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context()
        logger.info("Browser Runtime started.")

    async def get_page(self):
        if not self.context:
            return None
        pages = self.context.pages
        if pages:
            return pages[0]
        return await self.context.new_page()
