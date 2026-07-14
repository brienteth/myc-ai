import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
import logging

logger = logging.getLogger("myca.skills.email")

class EmailSendInputs(BaseModel):
    smtp_server: str = Field(default="smtp.gmail.com", description="SMTP server address")
    smtp_port: int = Field(default=587, description="SMTP server port (587 for TLS, 465 for SSL)")
    username: str = Field(description="Sender email address")
    password: str = Field(description="SMTP password or Gmail App Password")
    to_email: str = Field(description="Recipient email address")
    subject: str = Field(description="Subject line of the email")
    body: str = Field(description="Body content of the email")

class EmailReceiveInputs(BaseModel):
    imap_server: str = Field(default="imap.gmail.com", description="IMAP server address")
    imap_port: int = Field(default=993, description="IMAP server port (usually 993)")
    username: str = Field(description="Email address")
    password: str = Field(description="IMAP password or Gmail App Password")
    folder: str = Field(default="INBOX", description="Email folder to read")

@skill(
    id="email.send",
    name="Send Email",
    description="Sends an email using secure SMTP authentication.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=EmailSendInputs
)
async def send_email(ctx, smtp_server: str, smtp_port: int, username: str, password: str, to_email: str, subject: str, body: str) -> SkillResult:
    logger.info(f"[EMAIL] Sending email to {to_email}")
    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = username
        msg['To'] = to_email

        # Set up secure connection
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(username, password)
        server.sendmail(username, [to_email], msg.as_string())
        server.quit()

        return SkillResult(
            success=True,
            outputs={"success": True},
            logs=[f"Successfully sent email to {to_email} via SMTP"]
        )
    except Exception as e:
        logger.error(f"[EMAIL] Send failed: {e}")
        return SkillResult(success=False, logs=[f"Error sending email: {str(e)}"])

@skill(
    id="email.get_latest",
    name="Get Latest Email",
    description="Fetches the latest email details (sender, subject, body) from the inbox.",
    version="1.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=EmailReceiveInputs
)
async def get_latest_email(ctx, imap_server: str, imap_port: int, username: str, password: str, folder: str) -> SkillResult:
    logger.info(f"[EMAIL] Fetching latest email from {folder}")
    try:
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        mail.login(username, password)
        mail.select(folder)

        # Search for all emails
        status, data = mail.search(None, 'ALL')
        mail_ids = data[0].split()

        if not mail_ids:
            mail.close()
            mail.logout()
            return SkillResult(success=True, outputs={"found": False}, logs=["Inbox is empty"])

        # Fetch the latest email ID
        latest_id = mail_ids[-1]
        status, data = mail.fetch(latest_id, '(RFC822)')
        raw_email = data[0][1]

        # Parse content
        email_message = email.message_from_bytes(raw_email)
        subject = email_message['Subject'] or ""
        sender = email_message['From'] or ""
        
        # Decode body
        body = ""
        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                if content_type == "text/plain" and "attachment" not in content_disposition:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors='ignore')
                    break
        else:
            payload = email_message.get_payload(decode=True)
            if payload:
                body = payload.decode(errors='ignore')

        mail.close()
        mail.logout()

        return SkillResult(
            success=True,
            outputs={
                "found": True,
                "subject": subject,
                "sender": sender,
                "body": body
            },
            logs=[f"Successfully fetched latest email: '{subject}' from {sender}"]
        )
    except Exception as e:
        logger.error(f"[EMAIL] Fetch failed: {e}")
        return SkillResult(success=False, logs=[f"Error fetching email: {str(e)}"])
