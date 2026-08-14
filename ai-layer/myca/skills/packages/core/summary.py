from typing import Optional, Any
from myca.skills.core.decorator import skill

@skill(
    id="ai.summary",
    version="1.0.0",
    name="AI Summary",
    description="Summarizes text content or document excerpts using local or remote LLM engine.",
    category="AI",
    permissions=["ai.inference"],
    inputs=["text", "content", "prompt"],
    outputs=["summary", "response", "content"]
)
async def summary(ctx, text: Optional[str] = "", content: Optional[str] = "", prompt: Optional[str] = "") -> dict:
    text_content = text or content or prompt or ""
    if not isinstance(text_content, str):
        text_content = str(text_content)
        
    ctx.emit("ai.summary.started", {"text_len": len(text_content)})
    await ctx.check_cancel()
    
    summary_text = f"**Özet:**\n- {text_content[:300]}..."
    try:
        engine = getattr(getattr(ctx, "_runtime", None), "node", None)
        if engine and getattr(engine, "inference_engine", None):
            summary_text = await engine.inference_engine.generate(f"Aşağıdaki metni Türkçe olarak kısa ve özlü bir şekilde özetle:\n\n{text_content[:2000]}")
    except Exception as llm_err:
        pass
        
    return {"summary": summary_text, "response": summary_text, "content": summary_text}
