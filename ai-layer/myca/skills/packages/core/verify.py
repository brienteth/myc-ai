from myca.skills.core.decorator import skill

@skill(
    id="core.verify",
    version="1.0.0",
    permissions=[],
    inputs=["target_node", "target_skill", "payload"],
    outputs=["verified", "reason"]
)
async def verify(ctx, target_node: str, target_skill: str, payload: dict) -> dict:
    """
    Adversarial Edge Verifier Node.
    Validates side-effect payloads (e.g. file writes, email dispatches) before execution.
    """
    ctx.emit("core.verify.started", {"target_node": target_node, "target_skill": target_skill})
    await ctx.check_cancel()
    
    # 1. Check path traversal safety for filesystem write operations
    if target_skill in ["fs.write", "table.write", "fs.delete"]:
        path = str(payload.get("path", ""))
        if ".." in path or path.startswith("/etc") or path.startswith("/var"):
            return {
                "verified": False,
                "reason": f"Security violation: path traversal or system path restriction in '{path}'"
            }
            
    # 2. Check communication payload for email / slack dispatch
    if target_skill == "communication.send":
        recipient = payload.get("recipient", "")
        if not recipient or ("@" not in recipient and not recipient.startswith("http")):
            return {
                "verified": False,
                "reason": f"Invalid recipient or dispatch URL target: '{recipient}'"
            }
            
    return {
        "verified": True,
        "reason": f"Adversarial Edge Verification PASSED for node {target_node} ({target_skill}). Payload is safe."
    }
