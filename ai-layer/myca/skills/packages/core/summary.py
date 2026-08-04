from myca.skills.core.decorator import skill

@skill(
    id="ai.summary",
    version="1.0.0",
    permissions=[],
    inputs=["text"],
    outputs=["summary"]
)
async def summary(ctx, text: str) -> dict:
    ctx.emit("ai.summary.started", {"text_len": len(text)})
    await ctx.check_cancel()
    
    engine = ctx._runtime.node.inference_engine
    if not engine:
        return {"summary": "Error: Inference Engine not loaded."}
        
    prompt = f"Summarize the following text briefly in Turkish, focusing on key news updates:\n\n{text}"
    response_text = await engine.generate(prompt)
    
    return {"summary": response_text}
