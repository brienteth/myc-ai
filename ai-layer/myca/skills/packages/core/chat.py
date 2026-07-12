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
    
    # Get the inference engine from the runtime node
    engine = ctx._runtime.node.inference_engine
    if not engine:
        return {"response": "Error: Inference Engine not loaded."}
        
    # Generate the text response
    response_text = await engine.generate(prompt)
    
    return {"response": response_text}
