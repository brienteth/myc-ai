"""
Document Extractor
Handles PDF, TXT, MD, HTML, and other text/office documents.
"""
import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger("myca.library.extractors.document")

class DocumentExtractor:
    @staticmethod
    def extract(file_path: Path) -> Dict[str, Any]:
        """
        Extracts content and metadata from a document file.
        Returns dict with: content, title, author, page_count, language, tags, etc.
        """
        ext = file_path.suffix.lower()
        content = ""
        meta = {
            "title": file_path.name,
            "author": "Unknown",
            "page_count": 1,
            "language": "en"
        }

        try:
            if ext == ".pdf":
                from pypdf import PdfReader
                reader = PdfReader(str(file_path))
                pages_text = []
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        pages_text.append(txt)
                content = "\n".join(pages_text)
                
                meta["page_count"] = len(reader.pages)
                if reader.metadata:
                    meta["title"] = reader.metadata.title or file_path.name
                    meta["author"] = reader.metadata.author or "Unknown"

            elif ext == ".docx":
                try:
                    import docx
                    doc = docx.Document(str(file_path))
                    paragraphs = [p.text for p in doc.paragraphs if p.text]
                    content = "\n".join(paragraphs)
                    # Rough paragraph approximation as page count
                    meta["page_count"] = max(1, len(paragraphs) // 30)
                except ImportError:
                    logger.warning("python-docx not installed, fallback to binary decode.")
                    content = file_path.read_bytes().decode('utf-8', errors='ignore')

            elif ext in [".txt", ".md", ".html", ".htm", ".rtf"]:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                # Estimate page count by word length (approx 500 words per page)
                words = len(content.split())
                meta["page_count"] = max(1, words // 500)
                
                # Check MD for headings
                if ext == ".md" and content.startswith("#"):
                    first_line = content.split("\n")[0]
                    meta["title"] = first_line.replace("#", "").strip()

            else:
                content = file_path.read_bytes().decode('utf-8', errors='ignore')

        except Exception as e:
            logger.error(f"Failed to extract document {file_path.name}: {e}")
            content = f"[Document Extraction Error: {str(e)}]"

        return {
            "content": content,
            "metadata": meta
        }
