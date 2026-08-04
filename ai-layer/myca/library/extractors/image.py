"""
Image Extractor
Extracts EXIF metadata and generates thumbnails for PNG, JPEG, WEBP, and TIFF.
"""
import io
import logging
from pathlib import Path
from typing import Dict, Any, Tuple
from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger("myca.library.extractors.image")

class ImageExtractor:
    @staticmethod
    def extract(file_path: Path) -> Dict[str, Any]:
        """
        Extracts EXIF metadata, size, resolution, and dominant color.
        Returns dict with: content, metadata (dict), and thumbnail_bytes.
        """
        meta = {
            "title": file_path.name,
            "resolution": "Unknown",
            "camera": "Unknown",
            "date_taken": None,
            "dominant_color": "Unknown"
        }
        thumbnail_bytes = None
        content = "[Image file. Visual content analysis not implemented yet.]"

        try:
            with Image.open(file_path) as img:
                width, height = img.size
                meta["resolution"] = f"{width}x{height}"
                
                # Extract EXIF
                exif_data = {}
                info = img._getexif() if hasattr(img, '_getexif') else None
                if info:
                    for tag, value in info.items():
                        decoded = TAGS.get(tag, tag)
                        exif_data[decoded] = value
                
                if "Make" in exif_data or "Model" in exif_data:
                    make = exif_data.get("Make", "").strip()
                    model = exif_data.get("Model", "").strip()
                    meta["camera"] = f"{make} {model}".strip()
                
                if "DateTimeOriginal" in exif_data:
                    meta["date_taken"] = str(exif_data["DateTimeOriginal"])

                # Determine dominant color (simple resizing average)
                small_img = img.resize((1, 1))
                dominant_rgb = small_img.getpixel((0, 0))
                # Handle greyscale or alpha images
                if isinstance(dominant_rgb, int):
                    meta["dominant_color"] = f"#{dominant_rgb:02x}{dominant_rgb:02x}{dominant_rgb:02x}"
                elif len(dominant_rgb) >= 3:
                    meta["dominant_color"] = f"#{dominant_rgb[0]:02x}{dominant_rgb[1]:02x}{dominant_rgb[2]:02x}"

                # Generate thumbnail
                img.thumbnail((200, 200))
                thumb_io = io.BytesIO()
                # Save thumbnail as WebP
                img.save(thumb_io, format="WEBP", quality=80)
                thumbnail_bytes = thumb_io.getvalue()
                
        except Exception as e:
            logger.error(f"Failed to extract image {file_path.name}: {e}")
            content = f"[Image Extraction Error: {str(e)}]"

        return {
            "content": content,
            "metadata": meta,
            "thumbnail": thumbnail_bytes
        }
