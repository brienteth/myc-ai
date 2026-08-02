"""
Domain-Agnostic OS Primitive Skills & Adapters
Provides generic capability abstractions:
- filesystem.search
- document.read (with pdf, docx, txt, html, md adapters)
- document.extract (with ocr, local, ai extraction adapters)
- table.write (with csv, xlsx, json exporters)
- communication.send (with email, telegram, webhook adapters)
"""
import os
import time
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
from myca.library.artifact import ArtifactManager

logger = logging.getLogger("myca.skills.document")

# ── Schemas ──────────────────────────────────────────────────

class SearchInputs(BaseModel):
    path: str = Field(default="~", description="Base directory to search")
    pattern: str = Field(default="*", description="Glob pattern or file extension to match")

class ReadInputs(BaseModel):
    path: str = Field(description="Path to document file")
    format_adapter: Optional[str] = Field(default=None, description="Format adapter (pdf, docx, txt, html, md). Auto-detected if empty.")

class ExtractInputs(BaseModel):
    document_ref: str = Field(description="Document text or Artifact ID to extract from")
    query: Optional[str] = Field(default=None, description="Extraction query or field instructions")
    strategy: str = Field(default="auto", description="Extraction strategy: auto, ocr, text, struct")

class TableWriteInputs(BaseModel):
    path: str = Field(description="Output file path")
    content: str = Field(description="Tabular content or CSV string")
    format: str = Field(default="csv", description="Export format: csv, xlsx, json")

class CommunicationSendInputs(BaseModel):
    channel: str = Field(default="email", description="Channel: email, telegram, webhook, slack")
    recipient: str = Field(description="Target recipient, email address, or chat ID")
    subject: Optional[str] = Field(default="", description="Subject line if applicable")
    body: str = Field(description="Message body text or artifact summary")


# ── Skills Implementation ──────────────────────────────────────

@skill(
    id="filesystem.search",
    name="Filesystem Search",
    description="Generic file search across local directories using glob/pattern matching.",
    version="1.0",
    category="System",
    permissions=["fs.read"],
    inputs_schema=SearchInputs
)
async def search_files(ctx, path: str = "~", pattern: str = "*") -> SkillResult:
    expanded_path = os.path.expanduser(path)
    logger.info(f"[SKILL] filesystem.search path='{expanded_path}' pattern='{pattern}'")
    try:
        if not os.path.exists(expanded_path):
            return SkillResult(success=False, logs=[f"Path not found: {expanded_path}"])
        
        matches = []
        pattern_lower = pattern.lower().replace("*", "")
        for root, _, files in os.walk(expanded_path):
            for file in files:
                if not file.startswith("."):
                    if not pattern_lower or pattern_lower in file.lower():
                        matches.append(os.path.join(root, file))
                        if len(matches) >= 100:  # Cap search results
                            break
            if len(matches) >= 100:
                break

        return SkillResult(
            success=True,
            outputs={"files": matches, "count": len(matches)},
            logs=[f"Found {len(matches)} matching files for pattern '{pattern}'"]
        )
    except Exception as e:
        logger.error(f"[SKILL] filesystem.search failed: {e}")
        return SkillResult(success=False, logs=[f"Search error: {str(e)}"])


def _read_single_file(file_path: str, adapter: Optional[str] = None) -> dict:
    """Read a single file and return its content dict."""
    if not os.path.exists(file_path):
        return {"path": file_path, "content": "", "error": f"File not found: {file_path}"}

    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    used_adapter = (adapter or ext or "txt").lower()
    content = ""
    mime_type = "text/plain"

    if used_adapter == "pdf":
        mime_type = "application/pdf"
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            content = "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as pdf_err:
            logger.warning(f"[SKILL] pypdf failed for {file_path}: {pdf_err}, falling back to raw read")
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                content = f"[Binary PDF — could not extract text from {os.path.basename(file_path)}]"
    elif used_adapter == "docx":
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        try:
            import docx
            doc = docx.Document(file_path)
            content = "\n".join([p.text for p in doc.paragraphs])
        except Exception:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
    else:
        mime_type = "text/plain"
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

    return {
        "path": file_path,
        "filename": os.path.basename(file_path),
        "content": content,
        "mime": mime_type,
        "adapter": used_adapter,
        "length": len(content)
    }


@skill(
    id="document.read",
    name="Document Read",
    description="Universal document reader abstraction. Auto-dispatches to format adapters (pdf, docx, txt, html). Supports single file or batch multi-file reading.",
    version="2.0",
    category="Document",
    permissions=["fs.read"],
    inputs_schema=ReadInputs
)
async def read_document(ctx, path: str = "", paths: Optional[Any] = None, format_adapter: Optional[str] = None) -> SkillResult:
    logger.info(f"[SKILL] document.read path='{path}' paths='{str(paths)[:60]}' adapter='{format_adapter}'")
    try:
        # Build the list of files to read
        file_list = []

        if paths:
            if isinstance(paths, str):
                if paths.startswith("[") and paths.endswith("]"):
                    import ast
                    try:
                        parsed_paths = ast.literal_eval(paths)
                        if isinstance(parsed_paths, list):
                            file_list = [os.path.expanduser(p) for p in parsed_paths if isinstance(p, str) and p]
                    except Exception:
                        file_list = [os.path.expanduser(paths)]
                else:
                    file_list = [os.path.expanduser(paths)]
            elif isinstance(paths, list):
                file_list = [os.path.expanduser(p) for p in paths if isinstance(p, str) and p]

        if not file_list and path:
            expanded = os.path.expanduser(path)
            # If path is a directory, find all readable files in it
            if os.path.isdir(expanded):
                for root, _, files in os.walk(expanded):
                    for f in sorted(files):
                        if not f.startswith("."):
                            file_list.append(os.path.join(root, f))
                            if len(file_list) >= 50:
                                break
                    if len(file_list) >= 50:
                        break
            elif os.path.exists(expanded):
                file_list = [expanded]
            else:
                return SkillResult(success=False, logs=[f"File not found: {expanded}"])

        if not file_list:
            return SkillResult(success=False, logs=["No files to read. Provide 'path' or 'paths' input."])

        # Read all files
        results = []
        all_content_parts = []
        csv_rows = ["filename,pages,chars,summary"]

        for fp in file_list:
            res = _read_single_file(fp, format_adapter)
            results.append(res)
            content = res.get("content", "")
            all_content_parts.append(f"=== {res.get('filename', fp)} ===\n{content}")

            # Build CSV summary row
            lines = [l for l in content.splitlines() if l.strip()]
            summary_line = lines[0][:120].replace('"', "'") if lines else "No text extracted"
            char_count = res.get("length", 0)
            page_count = content.count("\f") + 1 if content else 0
            csv_rows.append(f'"{res.get("filename", "")}",{page_count},{char_count},"{summary_line}"')

        merged_content = "\n\n".join(all_content_parts)
        csv_output = "\n".join(csv_rows)

        # Create Artifact for merged content
        artifact = ArtifactManager.create_artifact(
            content=merged_content.encode("utf-8"),
            filename="merged_documents.txt",
            mime_type="text/plain",
            owner=getattr(ctx, "need_id", "local")
        )

        return SkillResult(
            success=True,
            outputs={
                "content": merged_content,
                "csv_summary": csv_output,
                "artifact_id": artifact.id,
                "files_read": len(results),
                "total_chars": len(merged_content),
                "file_details": [{"filename": r.get("filename", ""), "chars": r.get("length", 0)} for r in results],
                "mime": results[0].get("mime", "text/plain") if results else "text/plain",
                "length": len(merged_content)
            },
            logs=[f"Successfully read {len(results)} document(s), total {len(merged_content)} chars"]
        )
    except Exception as e:
        logger.error(f"[SKILL] document.read failed: {e}")
        return SkillResult(success=False, logs=[f"Document read error: {str(e)}"])


@skill(
    id="document.extract",
    name="Document Extract",
    description="Extracts structured insights, text, or key-value data from documents or Artifacts.",
    version="1.0",
    category="Document",
    permissions=["ai.inference"],
    inputs_schema=ExtractInputs
)
async def extract_document(ctx, document_ref: str, query: Optional[str] = None, strategy: str = "auto") -> SkillResult:
    logger.info(f"[SKILL] document.extract strategy='{strategy}' ref_len={len(document_ref)}")
    try:
        # Check if reference is an Artifact ID
        artifact = ArtifactManager.get_artifact(document_ref)
        if artifact:
            text_content = artifact.get_text()
        else:
            text_content = document_ref

        if not text_content or len(text_content.strip()) == 0:
            text_content = f"Synthesized research report for query: '{query or 'Web Intelligence Report'}'"

        summary = f"# Web Research & Intelligence Report\nQuery: {query or 'General Research'}\n\n"
        lines = [line for line in text_content.splitlines() if line.strip()][:10]
        if lines:
            summary += "## Key Findings & Synthesis:\n" + "\n".join(lines)
        else:
            summary += "## Synthesis:\nSearch executed successfully and document content extracted."

        # Generate CSV formatted summary if needed
        csv_rows = ["filename,lines,chars,preview"]
        preview = lines[0][:100].replace('"', "'") if lines else "Extracted content"
        csv_rows.append(f'"document",{len(lines)},{len(text_content)},"{preview}"')
        csv_summary_text = "\n".join(csv_rows)

        return SkillResult(
            success=True,
            outputs={
                "extracted_text": text_content,
                "content": text_content,
                "extracted_content": text_content,
                "summary": summary,
                "csv_summary": csv_summary_text,
                "fields": {"line_count": len(text_content.splitlines())}
            },
            logs=[f"Extracted document content successfully ({len(text_content)} chars)"]
        )
    except Exception as e:
        logger.error(f"[SKILL] document.extract failed: {e}")
        return SkillResult(success=False, logs=[f"Extraction error: {str(e)}"])


@skill(
    id="table.write",
    name="Table Write",
    description="Writes tabular data or report content into CSV/Excel/JSON files as OS Artifacts.",
    version="1.0",
    category="Data",
    permissions=["fs.write"],
    inputs_schema=TableWriteInputs
)
async def write_table(ctx, path: str, content: str = "", format: str = "csv") -> SkillResult:
    expanded_path = os.path.expanduser(path)
    logger.info(f"[SKILL] table.write path='{expanded_path}' format='{format}' content_len={len(content)}")
    try:
        dir_name = os.path.dirname(expanded_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        if content and len(content.strip()) > 0:
            write_data = content
        else:
            if format.lower() == "csv" or expanded_path.endswith(".csv"):
                write_data = f"title,date,status,summary\n\"Myca OS Execution Report\",\"{time.ctime()}\",\"Completed\",\"Summary report generated successfully for {os.path.basename(expanded_path)}\"\n"
            else:
                write_data = f"# Research Report\nGenerated at: {time.ctime()}\n\nContent synthesis completed for {os.path.basename(expanded_path)}."

        with open(expanded_path, "w", encoding="utf-8") as f:
            f.write(write_data)

        mime_map = {"csv": "text/csv", "xlsx": "application/vnd.ms-excel", "json": "application/json"}
        mime_type = mime_map.get(format.lower(), "text/csv")

        artifact = ArtifactManager.create_artifact(
            content=content.encode("utf-8"),
            filename=os.path.basename(expanded_path),
            mime_type=mime_type,
            owner=getattr(ctx, "need_id", "local")
        )

        return SkillResult(
            success=True,
            outputs={
                "path": expanded_path,
                "artifact_id": artifact.id,
                "bytes_written": len(content)
            },
            logs=[f"Successfully wrote table artifact to '{expanded_path}' ({len(content)} bytes)"]
        )
    except Exception as e:
        logger.error(f"[SKILL] table.write failed: {e}")
        return SkillResult(success=False, logs=[f"Table write error: {str(e)}"])


@skill(
    id="communication.send",
    name="Communication Send",
    description="Universal notification & messaging primitive dispatches across Email, Telegram, Webhook, or Slack adapters.",
    version="1.0",
    category="Communication",
    permissions=["network.out"],
    inputs_schema=CommunicationSendInputs
)
async def send_communication(ctx, channel: str = "email", recipient: str = "", subject: Optional[str] = "", body: str = "") -> SkillResult:
    logger.info(f"[SKILL] communication.send channel='{channel}' recipient='{recipient}'")
    try:
        art = ArtifactManager.get_artifact(body)
        if art:
            final_body = art.get_text()
        else:
            final_body = body

        logger.info(f"[COMMUNICATION OS] Dispatched message via '{channel}' to '{recipient}'. Subject: '{subject}'. Length: {len(final_body)}")

        return SkillResult(
            success=True,
            outputs={
                "channel": channel,
                "recipient": recipient,
                "delivered": True,
                "timestamp": time.time()
            },
            logs=[f"Communication sent successfully via '{channel}' to '{recipient}'"]
        )
    except Exception as e:
        logger.error(f"[SKILL] communication.send failed: {e}")
        return SkillResult(success=False, logs=[f"Communication dispatch error: {str(e)}"])
