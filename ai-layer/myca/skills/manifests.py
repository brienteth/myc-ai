"""
Pre-registered Core Skill Manifests for Myca Execution OS
"""

from myca.skills.manifest import SkillManifest, InputParam

CORE_SKILL_MANIFESTS = [
    SkillManifest(
        skill="telegram.send",
        version="2.1",
        name="Send Telegram Message",
        description="Sends a notification message to a Telegram channel or user chat.",
        category="Communication",
        required_credentials=["telegram_bot_token"],
        required_inputs=[
            InputParam(name="chat_id", type="string", description="Telegram Chat ID or @channelusername", required=True),
            InputParam(name="message", type="textarea", description="Message content to send", required=True)
        ],
        optional_inputs=[
            InputParam(name="parse_mode", type="select", description="HTML or Markdown formatting", required=False, default="HTML", options=["HTML", "Markdown", "MarkdownV2"]),
            InputParam(name="thread_id", type="string", description="Topic thread ID for supergroups", required=False),
            InputParam(name="disable_notification", type="boolean", description="Send silently", required=False, default=False)
        ],
        outputs=["message_id", "status"],
        permissions=["network.out"],
        runtime="network"
    ),
    SkillManifest(
        skill="slack.send",
        version="1.5",
        name="Send Slack Message",
        description="Posts a message to a Slack channel using OAuth Webhook or Bot Token.",
        category="Communication",
        required_credentials=["slack_oauth_token"],
        required_inputs=[
            InputParam(name="channel", type="string", description="#channel-name or channel ID", required=True),
            InputParam(name="text", type="textarea", description="Message text or block payload", required=True)
        ],
        optional_inputs=[
            InputParam(name="thread_ts", type="string", description="Reply to thread timestamp", required=False)
        ],
        outputs=["ts", "channel_id"],
        permissions=["network.out"],
        runtime="network"
    ),
    SkillManifest(
        skill="gmail.send",
        version="2.0",
        name="Send Gmail Email",
        description="Sends an email via Google Workspace OAuth API.",
        category="Communication",
        required_credentials=["google_oauth_token"],
        required_inputs=[
            InputParam(name="to", type="string", description="Recipient email address", required=True),
            InputParam(name="subject", type="string", description="Email subject line", required=True),
            InputParam(name="body", type="textarea", description="Email body content (HTML/Text)", required=True)
        ],
        optional_inputs=[
            InputParam(name="cc", type="string", description="Carbon copy recipients", required=False),
            InputParam(name="bcc", type="string", description="Blind carbon copy recipients", required=False)
        ],
        outputs=["email_id", "thread_id"],
        permissions=["network.out"],
        runtime="network"
    ),
    SkillManifest(
        skill="postgres.query",
        version="3.0",
        name="Execute PostgreSQL Query",
        description="Executes SQL query or DDL transaction on PostgreSQL DB cluster.",
        category="Database",
        required_credentials=["postgres_connection_string"],
        required_inputs=[
            InputParam(name="query", type="textarea", description="SQL SELECT/INSERT/UPDATE query string", required=True)
        ],
        optional_inputs=[
            InputParam(name="params", type="string", description="Query bind parameters (JSON array)", required=False)
        ],
        outputs=["rows", "row_count"],
        permissions=["network.out", "db.write"],
        runtime="network"
    ),
    SkillManifest(
        skill="0g.compute.run",
        version="1.0",
        name="0G Decentralized Compute Inference",
        description="Executes verifiable AI inference on the 0G decentralized GPU compute mesh.",
        category="Decentralized Compute",
        required_credentials=["zerog_private_key", "zerog_cluster_id"],
        required_inputs=[
            InputParam(name="model", type="select", description="Target 0G Model", required=True, options=["deepseek-r1-0g", "llama-3.3-70b-0g", "qwen-2.5-coder-0g"]),
            InputParam(name="prompt", type="textarea", description="Inference prompt input", required=True)
        ],
        optional_inputs=[
            InputParam(name="temperature", type="number", description="Sampling temperature", required=False, default=0.7)
        ],
        outputs=["text", "proof_of_inference", "tx_hash"],
        permissions=["network.out", "0g.compute"],
        runtime="0g"
    ),
    SkillManifest(
        skill="github.commit",
        version="1.2",
        name="GitHub Commit File",
        description="Commits and pushes code changes to a GitHub repository branch.",
        category="Developer Tools",
        required_credentials=["github_personal_token"],
        required_inputs=[
            InputParam(name="repo", type="string", description="Repository owner/repo (e.g. org/myca)", required=True),
            InputParam(name="path", type="string", description="File path in repo", required=True),
            InputParam(name="content", type="textarea", description="File content", required=True),
            InputParam(name="message", type="string", description="Git commit message", required=True)
        ],
        optional_inputs=[
            InputParam(name="branch", type="string", description="Target branch", required=False, default="main")
        ],
        outputs=["commit_sha", "url"],
        permissions=["network.out", "code.write"],
        runtime="network"
    ),
    SkillManifest(
        skill="fs.read",
        version="1.0",
        name="Read Local File",
        description="Reads text or binary file from local filesystem.",
        category="System",
        required_credentials=[],
        required_inputs=[
            InputParam(name="path", type="string", description="Absolute or relative file path", required=True)
        ],
        optional_inputs=[],
        outputs=["content", "size_bytes"],
        permissions=["fs.read"],
        runtime="local"
    ),
    SkillManifest(
        skill="core.chat",
        version="1.0",
        name="LLM Core Chat",
        description="General LLM completion step.",
        category="General",
        required_credentials=[],
        required_inputs=[
            InputParam(name="prompt", type="textarea", description="Instruction or user query", required=True)
        ],
        optional_inputs=[],
        outputs=["response"],
        permissions=[],
        runtime="local"
    )
]
