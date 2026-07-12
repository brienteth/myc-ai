"""
Verification script for Myca Phase 2.2 (Native Inference Engine).
Tests the unified engine interface, capability booting, and model lifecycle.
"""
import asyncio
import logging

from myca.inference.registry import BackendRegistry
import myca.inference.backends  # Triggers registration
from myca.inference.manager import InferenceManager

logging.basicConfig(level=logging.INFO)

async def test_native_engine():
    print("\n=== Test 1: Backend Registry Factory ===")
    engine = BackendRegistry.create_backend("mock")
    print(f"Created Engine Type: {type(engine).__name__}")
    
    manager = InferenceManager(engine)
    
    print("\n=== Test 2: 5-Stage Lifecycle Boot ===")
    await manager.boot_capability("chat")
    
    print("\n=== Test 3: Unified Inference API ===")
    
    # Generate
    res = await engine.generate("How are you?")
    print(f"Generate(): {res}")
    
    # Stream
    print("Stream():", end=" ", flush=True)
    async for token in engine.stream("Tell me a story."):
        print(token, end="", flush=True)
    print()
    
    # Embed
    emb = await engine.embed("Hello world")
    print(f"Embed(): {emb}")
    
    # Detokenize
    text = await engine.detokenize([1, 2, 3])
    print(f"Detokenize(): {text}")
    
if __name__ == "__main__":
    asyncio.run(test_native_engine())
