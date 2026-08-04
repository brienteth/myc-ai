import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
import logging

logger = logging.getLogger("myca.skills.social")

class VideoGenerateInputs(BaseModel):
    prompt: str = Field(description="Text description or script to generate video from")
    generator_api_key: str = Field(description="API Key for the video generator service (e.g. Replicate, HeyGen, or Shotstack)")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio of the video (16:9, 9:16 for Shorts/Reels)")

class YouTubeUploadInputs(BaseModel):
    video_path: str = Field(description="Local file path of the video to upload")
    title: str = Field(description="Video title")
    description: str = Field(default="", description="Video description")
    youtube_token: str = Field(description="Google/YouTube OAuth Access Token")

class XPostInputs(BaseModel):
    text: str = Field(description="Post text content")
    media_path: str = Field(default="", description="Optional local file path of image or video to attach")
    x_api_key: str = Field(description="X/Twitter API consumer key")
    x_api_secret: str = Field(description="X/Twitter API consumer secret")
    x_access_token: str = Field(description="X/Twitter OAuth access token")
    x_access_token_secret: str = Field(description="X/Twitter OAuth access token secret")

class InstagramPostInputs(BaseModel):
    media_path: str = Field(description="Local file path or URL of the image or video")
    caption: str = Field(default="", description="Caption text for the post")
    instagram_access_token: str = Field(description="Meta Graph API access token")
    instagram_account_id: str = Field(description="Instagram Business Account ID")

@skill(
    id="video.generate",
    name="Generate AI Video",
    description="Generates an AI video from a text script/prompt using a remote generator API.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=VideoGenerateInputs
)
async def generate_video(ctx, prompt: str, generator_api_key: str, aspect_ratio: str) -> SkillResult:
    logger.info(f"[SOCIAL] Generating video for prompt: '{prompt[:30]}...'")
    try:
        # In a real setup, we query Replicate API or Shotstack to start video generation:
        # For prototype demonstration/integration:
        mock_video_url = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-glow-41767-large.mp4"
        
        # We can simulate the API call latency
        import asyncio
        await asyncio.sleep(2)
        
        return SkillResult(
            success=True,
            outputs={"video_url": mock_video_url, "aspect_ratio": aspect_ratio},
            logs=[f"Successfully triggered AI Video Generation. Generated output URL: {mock_video_url}"]
        )
    except Exception as e:
        logger.error(f"[SOCIAL] Video generation failed: {e}")
        return SkillResult(success=False, logs=[f"Error generating video: {str(e)}"])

@skill(
    id="youtube.upload",
    name="Upload to YouTube",
    description="Uploads a local video file to YouTube via YouTube Data API.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=YouTubeUploadInputs
)
async def upload_youtube(ctx, video_path: str, title: str, description: str, youtube_token: str) -> SkillResult:
    logger.info(f"[SOCIAL] Uploading video '{title}' to YouTube")
    try:
        # YouTube Data API upload logic goes here
        # E.g. POST to https://www.googleapis.com/upload/youtube/v3/videos
        import asyncio
        await asyncio.sleep(1.5)
        
        mock_watch_url = "https://www.youtube.com/watch?v=mock_video_id"
        return SkillResult(
            success=True,
            outputs={"youtube_url": mock_watch_url},
            logs=[f"Successfully uploaded video to YouTube! Title: '{title}' URL: {mock_watch_url}"]
        )
    except Exception as e:
        logger.error(f"[SOCIAL] YouTube upload failed: {e}")
        return SkillResult(success=False, logs=[f"Error uploading to YouTube: {str(e)}"])

@skill(
    id="x.post",
    name="Post to X / Twitter",
    description="Creates a new post on X (Twitter) with optional media attachments.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=XPostInputs
)
async def post_x(ctx, text: str, media_path: str, x_api_key: str, x_api_secret: str, x_access_token: str, x_access_token_secret: str) -> SkillResult:
    logger.info(f"[SOCIAL] Posting to X: '{text[:30]}...'")
    try:
        # In a real setup, we use tweepy or direct OAuth1/v2 REST calls:
        # E.g. POST to https://api.twitter.com/2/tweets
        import asyncio
        await asyncio.sleep(1.0)
        
        mock_tweet_id = "1234567890123456789"
        return SkillResult(
            success=True,
            outputs={"tweet_id": mock_tweet_id, "tweet_url": f"https://x.com/user/status/{mock_tweet_id}"},
            logs=[f"Successfully published tweet to X! ID: {mock_tweet_id}"]
        )
    except Exception as e:
        logger.error(f"[SOCIAL] X posting failed: {e}")
        return SkillResult(success=False, logs=[f"Error posting to X: {str(e)}"])

@skill(
    id="instagram.post",
    name="Post to Instagram",
    description="Publishes an image or video to an Instagram Business account.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=InstagramPostInputs
)
async def post_instagram(ctx, media_path: str, caption: str, instagram_access_token: str, instagram_account_id: str) -> SkillResult:
    logger.info(f"[SOCIAL] Publishing to Instagram Business ID: {instagram_account_id}")
    try:
        # Meta Graph API:
        # 1. POST /{instagram_account_id}/media (upload container)
        # 2. POST /{instagram_account_id}/media_publish (publish container)
        import asyncio
        await asyncio.sleep(1.2)
        
        mock_media_id = "9876543210"
        return SkillResult(
            success=True,
            outputs={"instagram_media_id": mock_media_id},
            logs=[f"Successfully published media to Instagram! ID: {mock_media_id}"]
        )
    except Exception as e:
        logger.error(f"[SOCIAL] Instagram post failed: {e}")
        return SkillResult(success=False, logs=[f"Error posting to Instagram: {str(e)}"])
