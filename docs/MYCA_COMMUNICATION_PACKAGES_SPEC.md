# Myca Communication Packages & Generic ABI Specification

> **Architectural Philosophy:**
> - Core OS provides **Generic Communication ABIs** (`communication.send`, `communication.read`, `communication.listen`).
> - Platform-specific capabilities (Telegram, WhatsApp, Slack, Discord, Email, Teams, SMS, Voice) are installed as plug-and-play **Skill Packages** via `myca-pm`.
> - If an intent requires sending a message, the Planner outputs `communication.send`, which the Capability Router maps to whichever communication package is installed. If specified explicitly by the user, the exact package skill (e.g. `telegram.send_message`) is selected.

---

## 1. Generic OS ABI vs. Platform Skill Resolution

```text
                               Intent: "Send message"
                                         │
                                         ▼
                            Generic ABI: communication.send
                                         │
                                         ▼
                                 Capability Router
                                         │
        ┌───────────────────┬────────────┼────────────┬──────────────────┐
        ▼                   ▼            ▼            ▼                  ▼
  [pkg: telegram]    [pkg: whatsapp] [pkg: slack] [pkg: discord]   [pkg: email]
  telegram.send_message whatsapp.send slack.send  discord.send     email.send
```

---

## 2. Communication Packages Breakdown

### 📧 `myca-pm install email` (30 Skills)
`email.send`, `email.reply`, `email.forward`, `email.draft`, `email.read`, `email.search`, `email.delete`, `email.archive`, `email.labels`, `email.mark_read`, `email.mark_unread`, `email.attachments`, `email.download_attachment`, `email.save_attachment`, `email.move`, `email.spam`, `email.unspam`, `email.schedule`, `email.unsubscribe`, `email.contacts`, `email.templates`, `email.signature`, `email.thread`, `email.summary`, `email.translate`, `email.classify`, `email.extract_tasks`, `email.extract_contacts`, `email.watch`, `email.webhook`.

### ✈️ `myca-pm install telegram` (25 Skills)
`telegram.send_message`, `telegram.edit_message`, `telegram.delete_message`, `telegram.reply`, `telegram.forward`, `telegram.send_photo`, `telegram.send_video`, `telegram.send_document`, `telegram.send_voice`, `telegram.send_location`, `telegram.send_poll`, `telegram.create_group`, `telegram.create_channel`, `telegram.invite`, `telegram.ban_user`, `telegram.unban_user`, `telegram.pin_message`, `telegram.unpin_message`, `telegram.read_updates`, `telegram.watch_updates`, `telegram.webhook`, `telegram.chat_members`, `telegram.chat_info`, `telegram.bot_commands`, `telegram.inline_query`.

### 💬 `myca-pm install whatsapp` (25 Skills)
`whatsapp.send_message`, `whatsapp.send_template`, `whatsapp.send_media`, `whatsapp.send_document`, `whatsapp.send_location`, `whatsapp.send_contact`, `whatsapp.read_messages`, `whatsapp.reply`, `whatsapp.archive_chat`, `whatsapp.labels`, `whatsapp.search`, `whatsapp.mark_read`, `whatsapp.webhook`, `whatsapp.broadcast`, `whatsapp.group_create`, `whatsapp.group_invite`, `whatsapp.group_members`, `whatsapp.group_admin`, `whatsapp.catalog`, `whatsapp.order`, `whatsapp.customer_profile`, `whatsapp.status`, `whatsapp.analytics`, `whatsapp.templates`, `whatsapp.flows`.

### 🎮 `myca-pm install discord` (25 Skills)
`discord.send_message`, `discord.reply`, `discord.edit_message`, `discord.delete_message`, `discord.send_embed`, `discord.send_file`, `discord.create_channel`, `discord.create_thread`, `discord.join_voice`, `discord.leave_voice`, `discord.members`, `discord.roles`, `discord.permissions`, `discord.webhook`, `discord.events`, `discord.reactions`, `discord.slash_command`, `discord.bot_status`, `discord.guilds`, `discord.channels`, `discord.audit_logs`, `discord.invites`, `discord.forum`, `discord.announcements`, `discord.analytics`.

### 💼 `myca-pm install slack` (25 Skills)
`slack.send_message`, `slack.reply`, `slack.update_message`, `slack.delete_message`, `slack.channels`, `slack.users`, `slack.user_profile`, `slack.files_upload`, `slack.files_download`, `slack.reactions`, `slack.bookmarks`, `slack.canvas`, `slack.reminders`, `slack.webhook`, `slack.workflow`, `slack.search`, `slack.huddle`, `slack.calls`, `slack.status`, `slack.presence`, `slack.events`, `slack.audit`, `slack.analytics`, `slack.invite`, `slack.archive_channel`.

### 🏢 `myca-pm install teams` (20 Skills)
`teams.send_message`, `teams.reply`, `teams.create_channel`, `teams.create_team`, `teams.members`, `teams.meeting_create`, `teams.meeting_join`, `teams.calendar`, `teams.files`, `teams.tasks`, `teams.webhook`, `teams.calls`, `teams.presence`, `teams.recording`, `teams.transcript`, `teams.search`, `teams.analytics`, `teams.notifications`, `teams.approvals`, `teams.shifts`.

### 📱 `myca-pm install sms` (15 Skills)
`sms.send`, `sms.bulk`, `sms.schedule`, `sms.verify`, `sms.status`, `sms.balance`, `sms.templates`, `sms.receive`, `sms.webhook`, `sms.reply`, `sms.delivery_report`, `sms.contacts`, `sms.opt_out`, `sms.shortlink`, `sms.analytics`.

### 📞 `myca-pm install voice` (20 Skills)
`voice.call`, `voice.answer`, `voice.hangup`, `voice.transfer`, `voice.record`, `voice.transcribe`, `voice.tts`, `voice.ivr`, `voice.queue`, `voice.agent`, `voice.voicemail`, `voice.analytics`, `voice.webhook`, `voice.conference`, `voice.monitor`, `voice.dialer`, `voice.sms_fallback`, `voice.verify`, `voice.contacts`, `voice.history`.

---

## 3. Benefits of Plug-and-Play Platform Packages

1. **Zero Core Bloat**: Core OS binary stays minimal; platform integrations are lazy-loaded on demand.
2. **Independent Evolution**: When Slack or Telegram updates their API v2, only the specific package (`myca-skill-slack`) is updated via `myca-pm update slack`.
3. **Third-Party Marketplace**: Enterprise teams can build internal packages (e.g. `myca-pm install custom-crm-voice`) using the Skill Package Standard v2.0 without modifying Myca core.
