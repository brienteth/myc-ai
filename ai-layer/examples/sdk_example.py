"""
Myca SDK Usage Examples

This file demonstrates how to import and use Myca as an embedded library / SDK in any Python project.

To install Myca in your project:
    pip install myca                # Core client + HTTP remote
    pip install "myca[local]"        # Includes llama-cpp-python for in-process inference
"""

import asyncio
from myca import Myca, generate, scrape


async def example_basic_generation():
    print("\n--- 1. Basic Generation & Streaming ---")
    async with Myca(backend="mock") as ai:
        # One-shot async generation
        response = await ai.generate("Explain microservices in one sentence.")
        print(f"Generated: {response}")

        # Streaming generation
        print("Streaming: ", end="")
        async for token in ai.stream("Write a haiku about code."):
            print(token, end="", flush=True)
        print()


async def example_web_scraping():
    print("\n--- 2. Web Scraping & Extraction ---")
    async with Myca(backend="mock") as ai:
        # Scrape a URL to clean Markdown
        # page = await ai.scrape("https://news.ycombinator.com")
        # print(f"Title: {page['title']}")
        # print(f"Word count: {page['word_count']}")
        print("Scrape API ready: ai.scrape(url)")


async def example_second_brain():
    print("\n--- 3. Session Memory (Handover & Resume) ---")
    async with Myca(backend="mock") as ai:
        # End of session: save context snapshot
        handover = await ai.handover(
            summary="Refactored database layer and built SDK client",
            decisions=["Use asyncio context managers", "Keep backend modular"],
            next_steps=["Integrate into frontend web app"]
        )
        print(f"Saved session context: {handover['id']}")

        # Start of new session: reload context
        previous = await ai.resume()
        print(f"Resumed session context summary: {previous['summary']}")


async def example_software_factory():
    print("\n--- 4. Autonomous Software Factory ---")
    async with Myca(backend="mock") as ai:
        # Create structured spec
        spec = await ai.factory_spec("Implement dark mode toggle in user dashboard")
        print(f"Spec Created ID: {spec['id']}")
        print(f"Title: {spec['title']}")
        print(f"Criteria: {spec.get('acceptance_criteria', [])}")


def example_sync_helpers():
    print("\n--- 5. One-Shot Sync Helpers ---")
    # Synchronous one-line helper functions for non-async scripts
    # text = generate("Hello", backend="mock")
    # print(f"Sync Result: {text}")
    print("Sync helpers available: generate(prompt), scrape(url)")


async def main():
    await example_basic_generation()
    await example_web_scraping()
    await example_second_brain()
    await example_software_factory()
    example_sync_helpers()


if __name__ == "__main__":
    asyncio.run(main())
