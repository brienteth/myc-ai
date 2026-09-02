"""
Slack Communication Skill Package
Real Slack message dispatching via:
1. Slack Incoming Webhook (hooks.slack.com)
2. Slack Web API (slack.com/api/chat.postMessage)
"""
import logging
import httpx
from typing import Optional
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.network.slack")

class SlackSendInputs(BaseModel):
    message: str = Field(description="Message body text or markdown to post")
    webhook_url: Optional[str] = Field(default=None, description="Slack Incoming Webhook URL (https://hooks.slack.com/services/...)")
    bot_token: Optional[str] = Field(default=None, description="Slack Bot User OAuth Token (xoxb-...)")
    channel: Optional[str] = Field(default=None, description="Target Slack channel (e.g. #general or C12345678)")

@skill(
    id="slack.send",
    name="Send Slack Message",
    description="Posts a formatted notification or chat message to a Slack channel using Webhooks or Bot Token.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=SlackSendInputs
)
async def send_slack_message(
    ctx, 
    message: str, 
    webhook_url: Optional[str] = None, 
    bot_token: Optional[str] = None,
    channel: Optional[str] = None
) -> SkillResult:
    logger.info(f"[SLACK] Dispatching Slack message...")
    ctx.log("Preparing Slack message dispatch...")

    # Strategy 1: Incoming Webhook
    if webhook_url:
        payload = {"text": message}
        if channel:
            payload["channel"] = channel
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
                if resp.status_code == 200 and resp.text == "ok":
                    return SkillResult(
                        success=True,
                        outputs={"status": "sent", "channel": channel or "webhook_default"},
                        logs=["Slack webhook responded with 200 OK."]
                    )
                else:
                    return SkillResult(success=False, logs=[f"Slack Webhook Error {resp.status_code}: {resp.text}"])
        except Exception as e:
            return SkillResult(success=False, logs=[f"Slack Webhook connection failed: {str(e)}"])

    # Strategy 2: Slack Web API (chat.postMessage)
    if bot_token and channel:
        url = "https://slack.com/api/chat.postMessage"
        headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json"
        }
        payload = {"channel": channel, "text": message}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                data = resp.json()
                if data.get("ok"):
                    return SkillResult(
                        success=True,
                        outputs={"message_ts": data.get("ts"), "channel": data.get("channel")},
                        logs=[f"Successfully posted message to Slack channel {channel}."]
                    )
                else:
                    return SkillResult(success=False, logs=[f"Slack API Error: {data.get('error', 'unknown')}"])
        except Exception as e:
            return SkillResult(success=False, logs=[f"Slack API request failed: {str(e)}"])

    return SkillResult(
        success=False,
        logs=["Error: Please provide either a 'webhook_url' or both 'bot_token' and 'channel' to send to Slack."]
    )
