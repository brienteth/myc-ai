"""
Discord Communication Skill Package
Real Discord message dispatching via:
1. Discord Webhooks (discord.com/api/webhooks/...)
2. Discord Bot API (discord.com/api/v10/channels/{channel_id}/messages)
"""
import logging
import httpx
from typing import Optional
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.network.discord")

class DiscordSendInputs(BaseModel):
    message: str = Field(description="Message body text or markdown to post")
    webhook_url: Optional[str] = Field(default=None, description="Discord Webhook URL (https://discord.com/api/webhooks/...)")
    bot_token: Optional[str] = Field(default=None, description="Discord Bot Token")
    channel_id: Optional[str] = Field(default=None, description="Discord Target Channel ID")

@skill(
    id="discord.send",
    name="Send Discord Message",
    description="Dispatches a message or embed to a Discord channel via Webhook or Bot token.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=DiscordSendInputs
)
async def send_discord_message(
    ctx, 
    message: str, 
    webhook_url: Optional[str] = None, 
    bot_token: Optional[str] = None,
    channel_id: Optional[str] = None
) -> SkillResult:
    logger.info(f"[DISCORD] Dispatching Discord message...")
    ctx.log("Preparing Discord dispatch...")

    # Strategy 1: Discord Webhook
    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json={"content": message})
                if resp.status_code in (200, 204):
                    return SkillResult(
                        success=True,
                        outputs={"status": "sent", "channel": "webhook"},
                        logs=["Discord webhook responded with 200/204 Success."]
                    )
                else:
                    return SkillResult(success=False, logs=[f"Discord Webhook Error {resp.status_code}: {resp.text}"])
        except Exception as e:
            return SkillResult(success=False, logs=[f"Discord Webhook connection failed: {str(e)}"])

    # Strategy 2: Discord Bot API
    if bot_token and channel_id:
        url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
        headers = {
            "Authorization": f"Bot {bot_token}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json={"content": message})
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return SkillResult(
                        success=True,
                        outputs={"message_id": data.get("id"), "channel_id": channel_id},
                        logs=[f"Successfully posted message to Discord channel {channel_id}."]
                    )
                else:
                    return SkillResult(success=False, logs=[f"Discord Bot API Error {resp.status_code}: {resp.text}"])
        except Exception as e:
            return SkillResult(success=False, logs=[f"Discord Bot API failed: {str(e)}"])

    return SkillResult(
        success=False,
        logs=["Error: Please provide either 'webhook_url' or both 'bot_token' and 'channel_id' to send to Discord."]
    )
