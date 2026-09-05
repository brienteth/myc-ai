import pytest
from myca.memory import MemoryController as ExperienceMemory
from myca.recovery.dom_recovery import DOMRecoveryEngine
import uuid

@pytest.mark.asyncio
async def test_phase13_experience():
    """
    PHASE 13: EXPERIENCE TEST
    Verify that DOMRecoveryEngine queries ExperienceMemory to recover from a failure,
    and if it learns a new solution, it uses it next time.
    """
    # Patch DB_PATH to isolated temp database
    import tempfile
    import os
    import myca.database
    import myca.memory
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    
    myca.database.DB_PATH = __import__("pathlib").Path(db_path)
    myca.memory.DB_PATH = __import__("pathlib").Path(db_path)
    
    # Initialize the temp database
    myca.database.init_db()
    
    # Create isolated memory instance
    memory = ExperienceMemory(threshold=0.90)
    
    recovery_engine = DOMRecoveryEngine(memory)
    
    url = "https://example.com/login"
    dom_hash = "abc123hash"
    target_desc = "Login button"
    
    try:
        # 1. First attempt -> Should fail because nothing is learned
        with pytest.raises(Exception) as exc_info:
            await recovery_engine.attempt_recovery("browser.click", url, dom_hash, target_desc)
        
        assert "Recovery failed" in str(exc_info.value)
        
        # 2. Skill fails -> Auto learns -> System stores the new working selector
        working_selector = "button.login-submit"
        memory.store_selector(url, dom_hash, target_desc, working_selector)
        
        # 3. Next time -> knows how to handle
        recovered_selector = await recovery_engine.attempt_recovery("browser.click", url, dom_hash, target_desc)
        
        assert recovered_selector == working_selector
        
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
