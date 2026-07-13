import logging
import httpx
from typing import Optional
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.network.telegram")

class TelegramSendInputs(BaseModel):
    bot_token: Optional[str] = Field(default=None, description="Telegram Bot API Token")
    token: Optional[str] = Field(default=None, description="Alternative Telegram Bot API Token")
    chat_id: str = Field(description="Target Chat ID or Channel Username")
    message: str = Field(description="Message content to send")

@skill(
    id="telegram.send",
    name="Send Telegram Message",
    description="Sends a text message to a specific Telegram chat using a bot token.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=TelegramSendInputs
)
async def send_telegram_message(ctx, chat_id: str, message: str, bot_token: Optional[str] = None, token: Optional[str] = None) -> SkillResult:
    actual_token = bot_token or token
    if not actual_token:
        return SkillResult(
            success=False,
            outputs={},
            logs=["Error: Telegram bot token is missing. Please provide either 'bot_token' or 'token' in the inputs."]
        )
    url = f"https://api.telegram.org/bot{actual_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Telegram message sent successfully to {chat_id}")
                return SkillResult(
                    success=True,
                    outputs={"message_id": data.get("result", {}).get("message_id")},
                    logs=[f"Message sent successfully. Telegram responded with 200 OK."]
                )
            else:
                error_msg = f"Telegram API Error {response.status_code}: {response.text}"
                logger.error(error_msg)
                return SkillResult(
                    success=False,
                    outputs={},
                    logs=[error_msg]
                )
    except Exception as e:
        logger.error(f"Telegram connection failed: {e}")
        return SkillResult(
            success=False,
            outputs={},
            logs=[f"Connection failed: {str(e)}"]
        )
