import pytest
import asyncio
import time
from myca.inference.assistant import MycaAssistant
from myca.automation.brain import VaultDB

def test_assistant_cognitive_loop():
    async def run_test():
        # Setup database
        VaultDB.init_tables()
        
        # Save a test preference/decision note
        VaultDB.save_note({
            "id": "test-pref-1",
            "title": "Opacus Fallback Decision",
            "content_preview": "Use 0G fallback ONLY when local inference fails.",
            "tags": ["decision", "policy"],
            "links": [],
            "source_type": "decision",
            "created_at": time.time()
        })
        
        # Instantiate Assistant
        assistant = MycaAssistant()
        
        # Process a prompt that should retrieve the decision note
        res = await assistant.process_prompt("Geçen hafta Opacus hakkında ne karar vermiştik?")
        
        # Assertions
        assert res is not None
        assert res["mode"] == "KNOWLEDGE_MODE"
        assert len(res["context_details"]["decisions"]) > 0
        assert "Use 0G fallback ONLY when local inference fails." in res["context_details"]["decisions"]
        print("Unified Assistant cognitive loop verified successfully!")

    asyncio.run(run_test())
