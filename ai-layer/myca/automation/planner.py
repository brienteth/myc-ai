"""
Intent Automation Planner (Phase 3.0)
Converts user natural language descriptions into valid Workflow DAG graphs via local LLMs.
"""
import os
import json
import logging
import uuid
import time
from typing import Dict, Any
from myca.skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.automation.planner")

class AutomationPlanner:
    def __init__(self, inference_engine):
        self.inference = inference_engine

    async def plan_intent(self, user_prompt: str) -> dict:
        """
        Interprets natural language request to generate a structured Workflow schema JSON.
        """
        # Get all registered skills for LLM context mapping
        lower_prompt = user_prompt.lower()
        # Heuristic check removed so that the local LLM is always used to plan the intent.
        pass

        available_skills = SkillRegistry.get_manifests()
        
        system_prompt = f"""You are the Myca Automation Architect.
Your task is to translate a user's automation request into a strict, validated Workflow JSON DAG.
You MUST output ONLY valid JSON matching the format below. No markdown wrappers, no formatting text, no trailing comments.

Format:
{{
    "name": "Human-friendly Workflow Title",
    "description": "Short explanation",
    "trigger": {{
        "type": "interval" | "clipboard" | "folder_watch",
        "interval": 60,
        "regex": ".*",
        "path": "~/Downloads"
    }},
    "variables": {{}},
    "nodes": [
        {{
            "id": "node_id_A",
            "skill": "skill_name",
            "inputs": {{
                "param_name": "constant_value" or "{{{{variables.var_name}}}}" or "{{{{nodes.node_id_A.outputs.field}}}}"
            }},
            "depends_on": [],
            "retry": 0,
            "continue_on_error": false
        }}
    ],
    "edges": [
        {{
            "from": "node_id_A",
            "to": "node_id_B",
            "condition": null
        }}
    ],
    "permissions": ["fs", "network"]
}}

Available system skills to select from:
{json.dumps(available_skills, indent=2)}

Requirements:
1. Always resolve values using curly braces (e.g. {{{{variables.clipboard}}}} or {{{{nodes.A.response}}}}) for data pipes.
2. Select closest matching skills (like 'fs.read', 'core.chat', 'library.search').
3. Strictly format the JSON response. Do not include markdown codeblocks (e.g., ```json). Just start directly with {{.
"""

        # 1. Generate immediate valid intent fallback DAG
        fallback_plan = self._generate_fallback(user_prompt)
        
        # If specific skill matched (not basic chat), return immediately
        if fallback_plan and len(fallback_plan.get("nodes", [])) > 0:
            first_skill = fallback_plan["nodes"][0]["skill"]
            if first_skill != "core.chat":
                logger.info(f"[PLANNER] Matched specific intent for skill '{first_skill}'")
                return fallback_plan

        # If LLM inference is available, query LLM for custom DAG structure
        if self.inference:
            logger.info(f"[PLANNER] Querying LLM to plan intent: {user_prompt[:60]}...")
            try:
                raw_response = await self.inference.generate(user_prompt, system_prompt=system_prompt)
                if raw_response and isinstance(raw_response, str) and not raw_response.startswith("Internal"):
                    raw_response = raw_response.strip()

                    if raw_response.startswith("```"):
                        lines = raw_response.splitlines()
                        if lines[0].startswith("```"): lines = lines[1:]
                        if lines[-1].startswith("```"): lines = lines[:-1]
                        raw_response = "\n".join(lines).strip()

                    start_idx = raw_response.find('{')
                    end_idx = raw_response.rfind('}')
                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                        raw_response = raw_response[start_idx:end_idx+1]
                        raw_ast = json.loads(raw_response)
                        
                        if isinstance(raw_ast, dict) and "nodes" in raw_ast:
                            return {
                                "id": f"flow-{uuid.uuid4().hex[:8]}",
                                "name": raw_ast.get("name", f"Dynamic Workflow ({user_prompt[:25]}...)"),
                                "description": raw_ast.get("description", user_prompt),
                                "enabled": True,
                                "trigger": raw_ast.get("trigger", {"type": "manual"}),
                                "variables": raw_ast.get("variables", {}),
                                "nodes": raw_ast.get("nodes", []),
                                "edges": raw_ast.get("edges", []),
                                "permissions": raw_ast.get("permissions", ["fs.read", "fs.write", "network.out"])
                            }
            except Exception as e:
                logger.warning(f"[PLANNER] LLM planning query exception: {e}. Using intelligent fallback DAG.")

        return fallback_plan

    def _generate_fallback(self, prompt: str) -> dict:
        """Domain-Agnostic Dynamic Capability Intent Mapping."""
        w_id = f"flow-{uuid.uuid4().hex[:8]}"
        p_lower = prompt.lower()

        # Dynamic intent decomposition based on user keywords
        nodes = []
        edges = []

        # 1. Prioritize Web Search / Google Research intents over local folder searching
        is_web_research = any(w in p_lower for w in ["google", "araştır", "araştırma", "web", "site", "internet"]) and not any(w in p_lower for w in ["klasörümdeki", "klasördeki", "fatura"])
        
        has_folder_or_doc = not is_web_research and any(w in p_lower for w in ["fatura", "ocr", "tara", "scan", "klasör", "folder", "opacus", "opacusdocs"])
        if is_web_research:
            import re
            file_match = re.search(r'([\w\-\.]+\.(?:pdf|csv|json|txt))', prompt, re.IGNORECASE)
            target_filename = file_match.group(1) if file_match else "research_report.pdf"
            export_path = f"~/Desktop/{target_filename}"
            export_format = "pdf" if target_filename.endswith(".pdf") else ("csv" if target_filename.endswith(".csv") else "json")

            nodes = [
                {"id": "search_web", "skill": "browser.search", "inputs": {"query": prompt}, "depends_on": []},
                {"id": "synthesize_research", "skill": "core.chat", "inputs": {"prompt": f"Web ve Google aramaları sonucu elde edilen konu: '{prompt}'. Bu konuda Türkçe detaylı, teknik ve kapsamlı bir araştırma raporu metni oluştur."}, "depends_on": ["search_web"]},
                {"id": "export_report", "skill": "table.write", "inputs": {"path": export_path, "content": "{{nodes.synthesize_research.outputs.response}}", "format": export_format}, "depends_on": ["synthesize_research"]}
            ]
            edges = [{"from": "search_web", "to": "synthesize_research"}, {"from": "synthesize_research", "to": "export_report"}]
        elif has_folder_or_doc:
            # Dynamic Target Directory Extraction
            search_path = "~/Desktop"
            
            # Check Desktop subfolders for dynamic prompt matching
            desktop_dir = os.path.expanduser("~/Desktop")
            downloads_dir = os.path.expanduser("~/Downloads")
            
            matched_folder = None
            if os.path.exists(desktop_dir):
                for item in os.listdir(desktop_dir):
                    item_path = os.path.join(desktop_dir, item)
                    if os.path.isdir(item_path) and not item.startswith("."):
                        # Match folder name against prompt words
                        if item.lower() in p_lower or item.lower().replace(" ", "") in p_lower.replace(" ", ""):
                            matched_folder = f"~/Desktop/{item}"
                            break
            
            if not matched_folder and os.path.exists(downloads_dir):
                for item in os.listdir(downloads_dir):
                    item_path = os.path.join(downloads_dir, item)
                    if os.path.isdir(item_path) and not item.startswith("."):
                        if item.lower() in p_lower or item.lower().replace(" ", "") in p_lower.replace(" ", ""):
                            matched_folder = f"~/Downloads/{item}"
                            break

            if matched_folder:
                search_path = matched_folder
            elif "downloads" in p_lower or "indirilenler" in p_lower:
                search_path = "~/Downloads/myca" if "myca" in p_lower else "~/Downloads"

            # Dynamic Extension & Pattern Detection
            search_pattern = "*.pdf" if "pdf" in p_lower or "fatura" in p_lower else ("*.csv" if "csv" in p_lower else "*.*")
            
            # Dynamic Output Format & Target File
            export_format = "csv" if "csv" in p_lower or "excel" in p_lower else "json"
            export_filename = f"~/Desktop/summary_report.{export_format}"

            nodes = [
                {"id": "search_files", "skill": "filesystem.search", "inputs": {"path": search_path, "pattern": search_pattern}, "depends_on": []},
                {"id": "read_doc", "skill": "document.read", "inputs": {"paths": "{{nodes.search_files.outputs.files}}", "path": search_path}, "depends_on": ["search_files"]},
                {"id": "extract_data", "skill": "document.extract", "inputs": {"query": prompt, "document_ref": "{{nodes.read_doc.outputs.content}}", "strategy": "ocr" if "ocr" in p_lower else "auto"}, "depends_on": ["read_doc"]},
                {"id": "export_report", "skill": "table.write", "inputs": {"path": export_filename, "content": "{{nodes.read_doc.outputs.csv_summary}}", "format": export_format}, "depends_on": ["extract_data"]}
            ]
            edges = [
                {"from": "search_files", "to": "read_doc"},
                {"from": "read_doc", "to": "extract_data"},
                {"from": "extract_data", "to": "export_report"}
            ]
        elif "opacus" in p_lower or "mpc" in p_lower or "kinetic" in p_lower or "gizlilik" in p_lower:
            nodes = [
                {"id": "opacus_tools", "skill": "opacus.mpc", "inputs": {"action": "tools"}, "depends_on": []}
            ]
            edges = []
        elif "library" in p_lower or "kütüphane" in p_lower or "index" in p_lower:
            nodes = [
                {"id": "index_lib", "skill": "library.index", "inputs": {"path": "~/Documents"}, "depends_on": []},
                {"id": "search_lib", "skill": "library.search", "inputs": {"query": prompt}, "depends_on": ["index_lib"]}
            ]
            edges = [{"from": "index_lib", "to": "search_lib"}]
        elif "x" in p_lower or "tweet" in p_lower or "twitter" in p_lower or "instagram" in p_lower or "social" in p_lower:
            nodes = [
                {"id": "gen_social_text", "skill": "core.chat", "inputs": {"prompt": f"Write social media post for: {prompt}"}, "depends_on": []},
                {"id": "post_x", "skill": "x.post", "inputs": {"text": "{{nodes.gen_social_text.outputs.response}}"}, "depends_on": ["gen_social_text"]}
            ]
            edges = [{"from": "gen_social_text", "to": "post_x"}]
        elif "telegram" in p_lower:
            nodes = [
                {"id": "gen_msg", "skill": "core.chat", "inputs": {"prompt": prompt}, "depends_on": []},
                {"id": "send_tg", "skill": "communication.send", "inputs": {"channel": "telegram", "recipient": "@myca_channel", "body": "{{nodes.gen_msg.outputs.response}}"}, "depends_on": ["gen_msg"]}
            ]
            edges = [{"from": "gen_msg", "to": "send_tg"}]
        elif "youtube" in p_lower or "video" in p_lower:
            nodes = [
                {"id": "gen_video", "skill": "video.generate", "inputs": {"prompt": prompt, "duration_s": 30}, "depends_on": []},
                {"id": "upload_yt", "skill": "youtube.upload", "inputs": {"video_path": "{{nodes.gen_video.outputs.video_path}}", "title": prompt[:50]}, "depends_on": ["gen_video"]}
            ]
            edges = [{"from": "gen_video", "to": "upload_yt"}]
        elif "browser" in p_lower or "site" in p_lower or "web" in p_lower or "http" in p_lower or "ara" in p_lower or "rapor" in p_lower or "google" in p_lower:
            import re
            file_match = re.search(r'([\w\-\.]+\.(?:pdf|csv|json|txt))', prompt, re.IGNORECASE)
            target_filename = file_match.group(1) if file_match else "research_report.pdf"
            export_path = f"~/Desktop/{target_filename}"
            export_format = "pdf" if target_filename.endswith(".pdf") else ("csv" if target_filename.endswith(".csv") else "json")

            nodes = [
                {"id": "search_web", "skill": "browser.search", "inputs": {"query": prompt}, "depends_on": []},
                {"id": "synthesize_research", "skill": "core.chat", "inputs": {"prompt": f"Web ve Google aramaları sonucu elde edilen konu: '{prompt}'. Bu konuda Türkçe detaylı, teknik ve kapsamlı bir araştırma raporu metni oluştur."}, "depends_on": ["search_web"]},
                {"id": "export_report", "skill": "table.write", "inputs": {"path": export_path, "content": "{{nodes.synthesize_research.outputs.response}}", "format": export_format}, "depends_on": ["synthesize_research"]}
            ]
            edges = [{"from": "search_web", "to": "synthesize_research"}, {"from": "synthesize_research", "to": "export_report"}]
        elif "mail" in p_lower or "eposta" in p_lower or "gönder" in p_lower:
            nodes = [
                {"id": "search_doc", "skill": "filesystem.search", "inputs": {"path": "~/Desktop", "pattern": "*.*"}, "depends_on": []},
                {"id": "read_doc", "skill": "document.read", "inputs": {"path": "{{nodes.search_doc.outputs.files.0}}"}, "depends_on": ["search_doc"]},
                {"id": "send_mail", "skill": "communication.send", "inputs": {"recipient": "target@domain.com", "subject": prompt[:30], "body": "{{nodes.read_doc.outputs.content}}"}, "depends_on": ["read_doc"]}
            ]
            edges = [{"from": "search_doc", "to": "read_doc"}, {"from": "read_doc", "to": "send_mail"}]
        else:
            nodes = [
                {"id": "exec_intent", "skill": "core.chat", "inputs": {"prompt": prompt}, "depends_on": []}
            ]

        return {
            "id": w_id,
            "name": f"Dynamic Workflow ({prompt[:30]}...)",
            "description": prompt,
            "enabled": True,
            "trigger": {"type": "manual"},
            "variables": {},
            "nodes": nodes,
            "edges": edges,
            "permissions": ["fs.read", "fs.write", "network.out"]
        }

    def _generate_fallback_old(self, prompt: str) -> dict:
        """Domain-Agnostic Capability Fallback Mapping."""
        w_id = f"flow-{uuid.uuid4().hex[:8]}"
        now = time.time()

        # Domain-agnostic generic capability pipeline: search -> read -> extract -> table -> send
        if any(w in prompt.lower() for w in ["fatura", "invoice", "oku", "özetle", "mail", "excel", "desktop"]):
            return {
                "id": w_id,
                "name": "Domain-Agnostic Document Intelligence & Communication Pipeline",
                "description": "Searches filesystem, reads document via OS adapter, extracts text/data, exports table artifact, and sends communication.",
                "enabled": True,
                "trigger": {"type": "interval", "interval_seconds": 604800},  # Weekly Friday
                "variables": {},
                "nodes": [
                    {
                        "id": "search_docs",
                        "skill": "filesystem.search",
                        "inputs": {
                            "path": "~/Desktop",
                            "pattern": "*.pdf"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "read_doc",
                        "skill": "document.read",
                        "inputs": {
                            "path": "{{nodes.search_docs.outputs.files.0}}",
                            "format_adapter": "pdf"
                        },
                        "depends_on": ["search_docs"]
                    },
                    {
                        "id": "extract_data",
                        "skill": "document.extract",
                        "inputs": {
                            "document_ref": "{{nodes.read_doc.outputs.content}}",
                            "query": "Extract invoice numbers, totals, dates, and summaries"
                        },
                        "depends_on": ["read_doc"]
                    },
                    {
                        "id": "write_table_report",
                        "skill": "table.write",
                        "inputs": {
                            "path": "~/Desktop/invoices_summary.csv",
                            "content": "{{nodes.extract_data.outputs.summary}}",
                            "format": "csv"
                        },
                        "depends_on": ["extract_data"]
                    },
                    {
                        "id": "send_email_report",
                        "skill": "communication.send",
                        "inputs": {
                            "channel": "email",
                            "recipient": "user@company.com",
                            "subject": "Weekly Invoices Summary Report",
                            "body": "{{nodes.write_table_report.outputs.artifact_id}}"
                        },
                        "depends_on": ["write_table_report"]
                    }
                ],
                "edges": [
                    {"from": "search_docs", "to": "read_doc"},
                    {"from": "read_doc", "to": "extract_data"},
                    {"from": "extract_data", "to": "write_table_report"},
                    {"from": "write_table_report", "to": "send_email_report"}
                ],
                "permissions": ["fs.read", "fs.write", "network.out", "ai.inference"],
                "created_at": now,
                "updated_at": now
            }

        if "rakip" in prompt.lower() or "fiyat" in prompt.lower() or "competitor" in prompt.lower() or "pricing" in prompt.lower():
            return {
                "id": w_id,
                "name": "E-Commerce Competitor Price Monitor",
                "description": "Scrapes competitor websites for target product prices daily, compares with local cost threshold, and alerts the team on price changes.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 86400}, # Runs daily
                "variables": {},
                "nodes": [
                    {
                        "id": "search_competitor_price",
                        "skill": "browser.search",
                        "inputs": {
                            "query": "rakip e-ticaret sitesi en çok satan kulaklık fiyatı"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "compare_pricing",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Analyze the competitor product prices in these search results and suggest a competitive pricing strategy:\n\n{{nodes.search_competitor_price.outputs.results}}"
                        },
                        "depends_on": ["search_competitor_price"]
                    },
                    {
                        "id": "notify_pricing_change",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "💰 *Rakip Fiyat Analiz Raporu:*\n\nE-ticaret rakip fiyat karşılaştırma özeti:\n\n{{nodes.compare_pricing.outputs.summary}}"
                        },
                        "depends_on": ["compare_pricing"]
                    }
                ],
                "edges": [
                    {"from": "search_competitor_price", "to": "compare_pricing"},
                    {"from": "compare_pricing", "to": "notify_pricing_change"}
                ],
                "permissions": ["browser", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "sipariş" in prompt.lower() or "kargo" in prompt.lower() or "order" in prompt.lower() or "shipping" in prompt.lower():
            return {
                "id": w_id,
                "name": "E-Commerce Order & Shipping Automator",
                "description": "Reads new orders, processes customer details, updates shipping logs, and emails the tracking number to customers.",
                "enabled": False,
                "trigger": {"type": "directory", "path": "/Users/bl10buer/Desktop/orders", "event": "created"},
                "variables": {},
                "nodes": [
                    {
                        "id": "read_new_orders",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/orders/new_orders.csv"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "generate_shipping_notification",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Extract customer name, order number, and email. Write a friendly notification email confirming their order is shipped:\n\n{{nodes.read_new_orders.outputs.content}}"
                        },
                        "depends_on": ["read_new_orders"]
                    },
                    {
                        "id": "send_shipping_email",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.gmail.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "musteri@example.com",
                            "subject": "Siparişiniz Kargoya Verildi!",
                            "body": "{{nodes.generate_shipping_notification.outputs.summary}}"
                        },
                        "depends_on": ["generate_shipping_notification"]
                    }
                ],
                "edges": [
                    {"from": "read_new_orders", "to": "generate_shipping_notification"},
                    {"from": "generate_shipping_notification", "to": "send_shipping_email"}
                ],
                "permissions": ["fs.read", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "sepet" in prompt.lower() or "cart" in prompt.lower():
            return {
                "id": w_id,
                "name": "E-Commerce Abandoned Cart Recoverer",
                "description": "Identifies abandoned shopping carts, drafts custom discount code offers using AI, and emails customers to recover sales.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 43200}, # Runs twice a day
                "variables": {},
                "nodes": [
                    {
                        "id": "read_cart_logs",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/terk_edilen_sepetler.csv"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "draft_discount_offer",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Extract user emails and items left in cart. Draft a personalized email offering a 10% discount to encourage them to complete purchase:\n\n{{nodes.read_cart_logs.outputs.content}}"
                        },
                        "depends_on": ["read_cart_logs"]
                    },
                    {
                        "id": "send_recovery_email",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.gmail.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "kullanici@example.com",
                            "subject": "Sepetinizde Unuttuğunuz Ürünler Var!",
                            "body": "{{nodes.draft_discount_offer.outputs.summary}}"
                        },
                        "depends_on": ["draft_discount_offer"]
                    }
                ],
                "edges": [
                    {"from": "read_cart_logs", "to": "draft_discount_offer"},
                    {"from": "draft_discount_offer", "to": "send_recovery_email"}
                ],
                "permissions": ["fs.read", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "seo" in prompt.lower() or "açıklama" in prompt.lower() or "description" in prompt.lower():
            return {
                "id": w_id,
                "name": "E-Commerce Product SEO description Writer",
                "description": "Reads raw product specifications, writes SEO-optimized descriptions and titles, and logs outputs to a ready-to-upload CSV file.",
                "enabled": False,
                "trigger": {"type": "manual"},
                "variables": {},
                "nodes": [
                    {
                        "id": "read_raw_specs",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/ham_urun_ozellikleri.csv"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "write_seo_details",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Write a search engine optimized product title, a 150-word description with search keywords, and relevant metadata for this product specs:\n\n{{nodes.read_raw_specs.outputs.content}}"
                        },
                        "depends_on": ["read_raw_specs"]
                    },
                    {
                        "id": "save_seo_csv",
                        "skill": "fs.write",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/seo_urunler.csv",
                            "content": "SEO_Title,SEO_Description\n{{nodes.write_seo_details.outputs.summary}}"
                        },
                        "depends_on": ["write_seo_details"]
                    }
                ],
                "edges": [
                    {"from": "read_raw_specs", "to": "write_seo_details"},
                    {"from": "write_seo_details", "to": "save_seo_csv"}
                ],
                "permissions": ["fs.read", "fs.write"],
                "created_at": now,
                "updated_at": now
            }
        elif "stok" in prompt.lower() or "envanter" in prompt.lower() or "malzeme" in prompt.lower() or "stock" in prompt.lower() or "inventory" in prompt.lower():
            return {
                "id": w_id,
                "name": "KOBİ Stock Monitoring & Supplier Alert",
                "description": "Monitors stock levels in local CSV file, alerts the supplier via email when low, and updates the owner via Telegram.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 14400}, # Checks every 4 hours
                "variables": {},
                "nodes": [
                    {
                        "id": "read_stock_csv",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/stok_durumu.csv"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "detect_low_stock",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Find items with stock level less than 10 units in this CSV. Draft a purchase order request for them:\n\n{{nodes.read_stock_csv.outputs.content}}"
                        },
                        "depends_on": ["read_stock_csv"]
                    },
                    {
                        "id": "email_supplier",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.gmail.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "depo-tedarik@example.com",
                            "subject": "Yeni Malzeme Siparişi (Acil)",
                            "body": "Merhaba,\n\nAşağıdaki ürünler için sipariş geçmek istiyoruz:\n\n{{nodes.detect_low_stock.outputs.summary}}"
                        },
                        "depends_on": ["detect_low_stock"]
                    },
                    {
                        "id": "alert_owner",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "⚠️ *Düşük Stok Bildirimi:*\n\nStok kritik seviyenin altına indi, tedarikçiye otomatik sipariş geçildi:\n\n{{nodes.detect_low_stock.outputs.summary}}"
                        },
                        "depends_on": ["email_supplier"]
                    }
                ],
                "edges": [
                    {"from": "read_stock_csv", "to": "detect_low_stock"},
                    {"from": "detect_low_stock", "to": "email_supplier"},
                    {"from": "email_supplier", "to": "alert_owner"}
                ],
                "permissions": ["fs.read", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "yorum" in prompt.lower() or "memnuniyet" in prompt.lower() or "şikayet" in prompt.lower() or "review" in prompt.lower() or "feedback" in prompt.lower():
            return {
                "id": w_id,
                "name": "KOBİ Customer Review & Sentiment Tracker",
                "description": "Searches for new customer reviews online, analyzes sentiment with local AI, and forwards negative reviews directly to the owner.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 28800}, # Runs every 8 hours
                "variables": {},
                "nodes": [
                    {
                        "id": "search_reviews",
                        "skill": "browser.search",
                        "inputs": {
                            "query": "google işletme yorumları şikayetleri müşteri geri bildirimleri"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "analyze_sentiment",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Filter out any negative customer reviews and draft a polite professional response template to resolve their issue:\n\n{{nodes.search_reviews.outputs.results}}"
                        },
                        "depends_on": ["search_reviews"]
                    },
                    {
                        "id": "notify_manager",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "💬 *Müşteri Şikayet Bildirimi (Acil):*\n\nİnternette olumsuz bir yorum algılandı. Taslak cevap:\n\n{{nodes.analyze_sentiment.outputs.summary}}"
                        },
                        "depends_on": ["analyze_sentiment"]
                    }
                ],
                "edges": [
                    {"from": "search_reviews", "to": "analyze_sentiment"},
                    {"from": "analyze_sentiment", "to": "notify_manager"}
                ],
                "permissions": ["browser", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "satış" in prompt.lower() or "kasa" in prompt.lower() or "ciro" in prompt.lower() or "sales" in prompt.lower() or "revenue" in prompt.lower():
            return {
                "id": w_id,
                "name": "KOBİ Daily Revenue & Cash Flow Reporter",
                "description": "Reads daily transactions from a CSV file, summarizes total sales, margins, and sends a daily status message to the owner.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 86400}, # Daily
                "variables": {},
                "nodes": [
                    {
                        "id": "read_sales_data",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/gunluk_satis.csv"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "calculate_sales_summary",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Calculate total revenue, total transactions, and best selling product category from these daily sales log:\n\n{{nodes.read_sales_data.outputs.content}}"
                        },
                        "depends_on": ["read_sales_data"]
                    },
                    {
                        "id": "send_sales_to_telegram",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "📊 *Günlük Kasa ve Satış Raporu:*\n\nBugünün kasa kapanış özeti:\n\n{{nodes.calculate_sales_summary.outputs.summary}}"
                        },
                        "depends_on": ["calculate_sales_summary"]
                    }
                ],
                "edges": [
                    {"from": "read_sales_data", "to": "calculate_sales_summary"},
                    {"from": "calculate_sales_summary", "to": "send_sales_to_telegram"}
                ],
                "permissions": ["fs.read", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "müşteri bul" in prompt.lower() or "lead" in prompt.lower() or "contact" in prompt.lower() or "bulma" in prompt.lower():
            return {
                "id": w_id,
                "name": "KOBİ Lead Generator & Sales Emailer",
                "description": "Searches for target businesses locally, extracts contact details using AI, and drafts customized introductory sales pitches.",
                "enabled": False,
                "trigger": {"type": "manual"},
                "variables": {},
                "nodes": [
                    {
                        "id": "search_potential_leads",
                        "skill": "browser.search",
                        "inputs": {
                            "query": "istanbul butik cafe otel iletişim eposta adresleri"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "draft_personalized_pitch",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Find email addresses and business names in these search results. Draft a friendly business partnership proposal email tailored for them:\n\n{{nodes.search_potential_leads.outputs.results}}"
                        },
                        "depends_on": ["search_potential_leads"]
                    },
                    {
                        "id": "send_cold_email",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.gmail.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "potansiyel-musteri@example.com",
                            "subject": "İş Birliği & Tanıtım Teklifi",
                            "body": "{{nodes.draft_personalized_pitch.outputs.summary}}"
                        },
                        "depends_on": ["draft_personalized_pitch"]
                    }
                ],
                "edges": [
                    {"from": "search_potential_leads", "to": "draft_personalized_pitch"},
                    {"from": "draft_personalized_pitch", "to": "send_cold_email"}
                ],
                "permissions": ["browser", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "fatura" in prompt.lower() or "invoice" in prompt.lower():
            return {
                "id": w_id,
                "name": "Corporate Invoice & Receipt Processor",
                "description": "Monitors a directory for incoming PDF invoices, extracts details via AI, logs them to a CSV spreadsheet, and notifies accounting.",
                "enabled": False,
                "trigger": {"type": "directory", "path": "/Users/bl10buer/Desktop/invoices", "event": "created"},
                "variables": {},
                "nodes": [
                    {
                        "id": "list_invoices_folder",
                        "skill": "fs.list",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/invoices"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "read_new_invoice",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/invoices/new_invoice.txt"
                        },
                        "depends_on": ["list_invoices_folder"]
                    },
                    {
                        "id": "extract_invoice_details",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Extract Invoice ID, Vendor, Date, Tax, and Total Amount from this invoice: \n\n{{nodes.read_new_invoice.outputs.content}}"
                        },
                        "depends_on": ["read_new_invoice"]
                    },
                    {
                        "id": "write_to_accounting_sheet",
                        "skill": "fs.write",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/invoices_report.csv",
                            "content": "{{nodes.extract_invoice_details.outputs.summary}}"
                        },
                        "depends_on": ["extract_invoice_details"]
                    },
                    {
                        "id": "email_accounting_team",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.company.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "accounting@company.com",
                            "subject": "Yeni Fatura İşlendi",
                            "body": "Yeni fatura detayları veritabanına işlendi:\n\n{{nodes.extract_invoice_details.outputs.summary}}"
                        },
                        "depends_on": ["write_to_accounting_sheet"]
                    }
                ],
                "edges": [
                    {"from": "list_invoices_folder", "to": "read_new_invoice"},
                    {"from": "read_new_invoice", "to": "extract_invoice_details"},
                    {"from": "extract_invoice_details", "to": "write_to_accounting_sheet"},
                    {"from": "write_to_accounting_sheet", "to": "email_accounting_team"}
                ],
                "permissions": ["fs.read", "fs.write", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "destek" in prompt.lower() or "ticket" in prompt.lower() or "talep" in prompt.lower() or "support" in prompt.lower():
            return {
                "id": w_id,
                "name": "Corporate Support Ticket Auto-Router",
                "description": "Reads incoming customer support emails, classifies sentiment/topic using local LLM, and auto-forwards to correct department.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 600},
                "variables": {},
                "nodes": [
                    {
                        "id": "fetch_support_ticket",
                        "skill": "email.get_latest",
                        "inputs": {
                            "imap_server": "imap.company.com",
                            "imap_port": 993,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "folder": "INBOX"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "classify_ticket_urgency",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Classify the sentiment (Urgent/Medium/Low) and topic (Billing/Technical/Sales) of this customer request:\n\n{{nodes.fetch_support_ticket.outputs.body}}"
                        },
                        "depends_on": ["fetch_support_ticket"]
                    },
                    {
                        "id": "forward_to_correct_team",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.company.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "tech-support@company.com",
                            "subject": "New Ticket Classified: [{{nodes.classify_ticket_urgency.outputs.summary}}]",
                            "body": "Customer request has been classified. Details:\n\nSender: {{nodes.fetch_support_ticket.outputs.sender}}\nContent:\n{{nodes.fetch_support_ticket.outputs.body}}"
                        },
                        "depends_on": ["classify_ticket_urgency"]
                    }
                ],
                "edges": [
                    {"from": "fetch_support_ticket", "to": "classify_ticket_urgency"},
                    {"from": "classify_ticket_urgency", "to": "forward_to_correct_team"}
                ],
                "permissions": ["network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "rapor" in prompt.lower() or "database" in prompt.lower() or "excel" in prompt.lower() or "csv" in prompt.lower() or "veri" in prompt.lower():
            return {
                "id": w_id,
                "name": "Corporate DB Report Builder & Sender",
                "description": "Periodically executes Postgres/SQLite database metrics query, builds local CSV/Excel report, and emails it to directors.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 86400}, # Runs daily
                "variables": {},
                "nodes": [
                    {
                        "id": "read_db_file",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/myca_db_logs.txt"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "summarize_db_metrics",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "Summarize these daily transactional metrics and highlight anomalies:\n\n{{nodes.read_db_file.outputs.content}}"
                        },
                        "depends_on": ["read_db_file"]
                    },
                    {
                        "id": "create_excel_report",
                        "skill": "fs.write",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/daily_financial_report.csv",
                            "content": "Metric,Value\nTotal Transactions,1200\nAnomalies Detected,{{nodes.summarize_db_metrics.outputs.summary}}"
                        },
                        "depends_on": ["summarize_db_metrics"]
                    },
                    {
                        "id": "email_directors",
                        "skill": "email.send",
                        "inputs": {
                            "smtp_server": "smtp.company.com",
                            "smtp_port": 587,
                            "username": "{{secrets.EMAIL_USERNAME}}",
                            "password": "{{secrets.EMAIL_PASSWORD}}",
                            "to_email": "directors@company.com",
                            "subject": "Günlük Finansal Rapor Özeti",
                            "body": "Merhaba,\n\nGünlük veritabanı analiz özeti ektedir:\n\n{{nodes.summarize_db_metrics.outputs.summary}}"
                        },
                        "depends_on": ["create_excel_report"]
                    }
                ],
                "edges": [
                    {"from": "read_db_file", "to": "summarize_db_metrics"},
                    {"from": "summarize_db_metrics", "to": "create_excel_report"},
                    {"from": "create_excel_report", "to": "email_directors"}
                ],
                "permissions": ["fs.read", "fs.write", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "youtube" in prompt.lower() or "instagram" in prompt.lower() or "paylaş" in prompt.lower() or "video" in prompt.lower() or "twit" in prompt.lower():
            return {
                "id": w_id,
                "name": "AI Video Creator & Social Publisher",
                "description": "Automatically generates a video from a script prompt and publishes it across YouTube, X/Twitter, and Instagram.",
                "enabled": False,
                "trigger": {"type": "manual"},
                "variables": {},
                "nodes": [
                    {
                        "id": "generate_ai_video",
                        "skill": "video.generate",
                        "inputs": {
                            "prompt": "Son kripto haberlerini anlatan 15 saniyelik dikey bir Shorts videosu hazırla.",
                            "generator_api_key": "{{secrets.REPLICATE_API_KEY}}",
                            "aspect_ratio": "9:16"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "publish_youtube",
                        "skill": "youtube.upload",
                        "inputs": {
                            "video_path": "{{nodes.generate_ai_video.outputs.video_url}}",
                            "title": "Son Dakika Kripto Gelişmeleri!",
                            "description": "Myca OS tarafından otonom olarak üretilmiştir.",
                            "youtube_token": "{{secrets.YOUTUBE_OAUTH_TOKEN}}"
                        },
                        "depends_on": ["generate_ai_video"]
                    },
                    {
                        "id": "publish_x",
                        "skill": "x.post",
                        "inputs": {
                            "text": "Bugünün en önemli gelişmeleri! 🚀 #crypto #ai",
                            "media_path": "{{nodes.generate_ai_video.outputs.video_url}}",
                            "x_api_key": "{{secrets.X_API_KEY}}",
                            "x_api_secret": "{{secrets.X_API_SECRET}}",
                            "x_access_token": "{{secrets.X_ACCESS_TOKEN}}",
                            "x_access_token_secret": "{{secrets.X_ACCESS_TOKEN_SECRET}}"
                        },
                        "depends_on": ["generate_ai_video"]
                    },
                    {
                        "id": "publish_instagram",
                        "skill": "instagram.post",
                        "inputs": {
                            "media_path": "{{nodes.generate_ai_video.outputs.video_url}}",
                            "caption": "Otonom haber bülteni! 🤖",
                            "instagram_access_token": "{{secrets.INSTAGRAM_ACCESS_TOKEN}}",
                            "instagram_account_id": "{{secrets.INSTAGRAM_ACCOUNT_ID}}"
                        },
                        "depends_on": ["generate_ai_video"]
                    }
                ],
                "edges": [
                    {"from": "generate_ai_video", "to": "publish_youtube"},
                    {"from": "generate_ai_video", "to": "publish_x"},
                    {"from": "generate_ai_video", "to": "publish_instagram"}
                ],
                "permissions": ["network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "mail" in prompt.lower() or "email" in prompt.lower() or "posta" in prompt.lower():
            if "oku" in prompt.lower() or "gelen" in prompt.lower() or "kontrol" in prompt.lower() or "read" in prompt.lower() or "check" in prompt.lower():
                return {
                    "id": w_id,
                    "name": "Check Latest Email",
                    "description": "Periodically checks your inbox for new emails and forwards details to Telegram.",
                    "enabled": False,
                    "trigger": {"type": "interval", "interval_seconds": 600}, # Checks every 10 mins
                    "variables": {},
                    "nodes": [
                        {
                            "id": "get_email",
                            "skill": "email.get_latest",
                            "inputs": {
                                "imap_server": "imap.gmail.com",
                                "imap_port": 993,
                                "username": "{{secrets.EMAIL_USERNAME}}",
                                "password": "{{secrets.EMAIL_PASSWORD}}",
                                "folder": "INBOX"
                            },
                            "depends_on": []
                        },
                        {
                            "id": "telegram_send",
                            "skill": "telegram.send",
                            "inputs": {
                                "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                                "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                                "message": "📧 *Yeni E-posta Alındı:*\n\nKimden: {{nodes.get_email.outputs.sender}}\nKonu: {{nodes.get_email.outputs.subject}}\n\nİçerik:\n{{nodes.get_email.outputs.body}}"
                            },
                            "depends_on": ["get_email"]
                        }
                    ],
                    "edges": [
                        {"from": "get_email", "to": "telegram_send"}
                    ],
                    "permissions": ["network.out"],
                    "created_at": now,
                    "updated_at": now
                }
            else:
                return {
                    "id": w_id,
                    "name": "Send Email Notification",
                    "description": "Sends an email notification via SMTP automatically when triggered.",
                    "enabled": False,
                    "trigger": {"type": "manual"},
                    "variables": {},
                    "nodes": [
                        {
                            "id": "send_mail",
                            "skill": "email.send",
                            "inputs": {
                                "smtp_server": "smtp.gmail.com",
                                "smtp_port": 587,
                                "username": "{{secrets.EMAIL_USERNAME}}",
                                "password": "{{secrets.EMAIL_PASSWORD}}",
                                "to_email": "recipient@example.com",
                                "subject": "Myca OS Bilgilendirme",
                                "body": "Myca otonom iş akışı başarıyla çalıştı ve bu maili gönderdi!"
                            },
                            "depends_on": []
                        }
                    ],
                    "edges": [],
                    "permissions": ["network.out"],
                    "created_at": now,
                    "updated_at": now
                }
        elif "kripto" in prompt.lower() or "haber" in prompt.lower() or "crypto" in prompt.lower() or "news" in prompt.lower():
            return {
                "id": w_id,
                "name": "Crypto News Alert Crawler",
                "description": "Periodically searches for the latest crypto news, summarizes it using local AI, and forwards it to your Telegram chat.",
                "enabled": False,
                "trigger": {"type": "interval", "interval_seconds": 3600},
                "variables": {},
                "nodes": [
                    {
                        "id": "crypto_search",
                        "skill": "browser.search",
                        "inputs": {
                            "query": "kripto para son dakika haberleri"
                        },
                        "depends_on": []
                    },
                    {
                        "id": "summarize_news",
                        "skill": "ai.summary",
                        "inputs": {
                            "text": "{{nodes.crypto_search.outputs.results}}"
                        },
                        "depends_on": ["crypto_search"]
                    },
                    {
                        "id": "telegram_send",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "🔔 *Son Dakika Kripto Gelişmeleri:*\n\n{{nodes.summarize_news.outputs.summary}}"
                        },
                        "depends_on": ["summarize_news"]
                    }
                ],
                "edges": [
                    {"from": "crypto_search", "to": "summarize_news"},
                    {"from": "summarize_news", "to": "telegram_send"}
                ],
                "permissions": ["browser", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "yaz" in prompt.lower() or "write" in prompt.lower() or "dosya" in prompt.lower() or "read" in prompt.lower() or "oku" in prompt.lower():
            return {
                "id": w_id,
                "name": "Filesystem Manager Flow",
                "description": "Performs file read/write operations and sends notifications.",
                "enabled": False,
                "trigger": {"type": "manual"},
                "variables": {},
                "nodes": [
                    {
                        "id": "write_file",
                        "skill": "fs.write",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/myca_output.txt",
                            "content": "Hello from Myca Execution OS! This is a test file written dynamically via automation."
                        },
                        "depends_on": []
                    },
                    {
                        "id": "read_file",
                        "skill": "fs.read",
                        "inputs": {
                            "path": "/Users/bl10buer/Desktop/myca_output.txt"
                        },
                        "depends_on": ["write_file"]
                    },
                    {
                        "id": "telegram_send",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "Filesystem workflow finished! Read content:\n\n{{nodes.read_file.outputs.content}}"
                        },
                        "depends_on": ["read_file"]
                    }
                ],
                "edges": [
                    {"from": "write_file", "to": "read_file"},
                    {"from": "read_file", "to": "telegram_send"}
                ],
                "permissions": ["fs.write", "fs.read", "network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif ("clipboard" in prompt.lower() or "kopyala" in prompt.lower()) and "telegram" in prompt.lower():
            return {
                "id": w_id,
                "name": "Clipboard to Telegram Forwarder",
                "description": "Monitors the clipboard and automatically forwards any copied text to your Telegram chat.",
                "enabled": True,
                "trigger": {"type": "clipboard", "regex": ".*"},
                "variables": {},
                "nodes": [
                    {
                        "id": "telegram_send",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "New clipboard content detected:\n\n{{variables.clipboard}}"
                        },
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["network.out"],
                "created_at": now,
                "updated_at": now
            }
        elif "clipboard" in prompt.lower() or "kopyala" in prompt.lower():
            return {
                "id": w_id,
                "name": "Auto OCR on Clipboard",
                "description": "Reads matching clipboard data and runs local AI summary.",
                "enabled": False,
                "trigger": {"type": "clipboard", "regex": ".*"},
                "variables": {},
                "nodes": [
                    {
                        "id": "A",
                        "skill": "core.chat",
                        "inputs": {"prompt": "Summarize this clipboard content: {{variables.clipboard}}"},
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["network"],
                "created_at": now,
                "updated_at": now
            }
        elif "telegram" in prompt.lower():
            return {
                "id": w_id,
                "name": "Telegram Test Flow",
                "description": "Sends a message to a Telegram chat.",
                "enabled": False,
                "trigger": {"type": "manual"},
                "variables": {},
                "nodes": [
                    {
                        "id": "telegram_send",
                        "skill": "telegram.send",
                        "inputs": {
                            "bot_token": "{{secrets.TELEGRAM_BOT_TOKEN}}",
                            "chat_id": "{{secrets.TELEGRAM_CHAT_ID}}",
                            "message": "Hello from Myca Execution OS! The workflow successfully triggered."
                        },
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["network.out"],
                "created_at": now,
                "updated_at": now
            }
        else:
            return {
                "id": w_id,
                "name": "Periodic Library Backup",
                "description": "Daily trigger checking library stats.",
                "enabled": False,
                "trigger": {"type": "interval", "interval": 3600},
                "variables": {},
                "nodes": [
                    {
                        "id": "A",
                        "skill": "library.history",
                        "inputs": {},
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["library"],
                "created_at": now,
                "updated_at": now
            }
