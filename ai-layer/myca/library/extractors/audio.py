"""
Audio Extractor
Extracts duration, metadata, and generates transcription via faster-whisper.
"""
import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger("myca.library.extractors.audio")

class AudioExtractor:
    @staticmethod
    def extract(file_path: Path) -> Dict[str, Any]:
        """
        Extracts duration, language, and transcription.
        Returns dict with: content, metadata.
        """
        content = ""
        meta = {
            "title": file_path.name,
            "duration_seconds": 0.0,
            "language": "unknown"
        }

        # Try estimating duration from file size if audio metadata readers aren't present
        # Or try importing standard packages
        try:
            # simple estimate: 128kbps mp3 ~ 16KB/s
            size_kb = file_path.stat().st_size / 1024
            meta["duration_seconds"] = round(size_kb / 16, 1)
        except Exception:
            pass

        # Perform transcription
        try:
            from faster_whisper import WhisperModel
            logger.info(f"Transcribing audio file: {file_path.name}")
            # Loaded dynamically, using 'tiny' model on CPU to prevent crash
            model = WhisperModel("tiny", device="cpu", compute_type="int8")
            segments, info = model.transcribe(str(file_path), beam_size=3)
            
            meta["language"] = info.language
            meta["duration_seconds"] = round(info.duration, 1)
            
            transcripts = [segment.text for segment in segments]
            content = " ".join(transcripts)
            logger.info("Audio transcription completed successfully.")
        except ImportError:
            logger.warning("faster-whisper is not installed. Skipping audio transcription.")
            content = "[Audio transcription pending - faster-whisper not installed]"
        except Exception as e:
            logger.error(f"Error transcribing audio {file_path.name}: {e}")
            content = f"[Audio Transcription Error: {str(e)}]"

        return {
            "content": content,
            "metadata": meta
        }
