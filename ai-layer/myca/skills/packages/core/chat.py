from myca.skills.core.decorator import skill

@skill(
    id="core.chat",
    version="1.0.0",
    permissions=[],
    inputs=["prompt"],
    outputs=["response"]
)
async def chat(ctx, prompt: str) -> dict:
    ctx.emit("core.chat.started", {"prompt": prompt})
    await ctx.check_cancel()
    
    try:
        engine = getattr(ctx._runtime, "node", None)
        if engine:
            engine = getattr(engine, "inference_engine", None)
            
        if not engine:
            from myca.inference.registry import BackendRegistry
            engine = BackendRegistry.create_backend("auto")
            
        # Generate the text response
        response_text = await engine.generate(prompt)
        return {"response": response_text}
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        return {"response": f"Exception in core.chat:\n{err}"}
