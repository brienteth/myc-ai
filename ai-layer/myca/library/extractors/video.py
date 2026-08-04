"""
Video Extractor
Extracts duration, resolution, frame rate, and generates thumbnail image.
"""
import io
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger("myca.library.extractors.video")

class VideoExtractor:
    @staticmethod
    def extract(file_path: Path) -> Dict[str, Any]:
        """
        Extracts video metadata and generates thumbnail.
        Returns dict with: content, metadata, and thumbnail.
        """
        content = "[Video file. Scene analysis and speech transcription not active.]"
        meta = {
            "title": file_path.name,
            "duration_seconds": 0.0,
            "resolution": "Unknown",
            "fps": 0.0
        }
        thumbnail_bytes = None

        # 1. Try metadata & thumbnail extraction using opencv
        try:
            import cv2
            cap = cv2.VideoCapture(str(file_path))
            if cap.isOpened():
                fps = cap.get(cv2.CAP_PROP_FPS)
                frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                
                meta["fps"] = round(fps, 2)
                meta["resolution"] = f"{width}x{height}"
                if fps > 0:
                    meta["duration_seconds"] = round(frame_count / fps, 1)

                # Capture frame at 10% of the video duration as thumbnail
                target_frame = int(frame_count * 0.1)
                cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                ret, frame = cap.read()
                if ret:
                    # Convert to PIL Image
                    from PIL import Image
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(frame_rgb)
                    img.thumbnail((200, 200))
                    
                    thumb_io = io.BytesIO()
                    img.save(thumb_io, format="WEBP", quality=80)
                    thumbnail_bytes = thumb_io.getvalue()
                    
                cap.release()
        except ImportError:
            logger.warning("opencv-python not installed. Skipping video frame processing.")
        except Exception as e:
            logger.error(f"Error extracting video metadata from {file_path.name}: {e}")

        # 2. Simple fallbacks for duration based on size
        if meta["duration_seconds"] == 0.0:
            try:
                # rough video size estimate: 500KB/s
                size_kb = file_path.stat().st_size / 1024
                meta["duration_seconds"] = round(size_kb / 500, 1)
            except Exception:
                pass

        return {
            "content": content,
            "metadata": meta,
            "thumbnail": thumbnail_bytes
        }
