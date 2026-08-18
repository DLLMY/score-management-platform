from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import smtplib

# (空行)
# 邮件服务工具模块
# 提供邮件发送功能
# (空行)


class EmailService:
    """邮件服务"""

    def __init__(self):
        self.smtp_server = None
        self.smtp_port = None
        self.smtp_username = None
        self.smtp_password = None
        self.enabled = False

    def configure(self, server: str, port: int, username: str, password: str, enabled: bool = True):
        """配置邮件服务"""
        self.smtp_server = server
        self.smtp_port = port
        self.smtp_username = username
        self.smtp_password = password
        self.enabled = enabled

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        cc: Optional[List[str]] = None,
    ) -> bool:
        """发送邮件"""
        if not self.enabled:
            return False
        try:
            msg = MIMEMultipart()
            msg["From"] = from_email or self.smtp_username
            msg["To"] = to_email
            msg["Subject"] = subject
            if cc:
                msg["Cc"] = ", ".join(cc)
            msg.attach(MIMEText(body, "html", "utf-8"))
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                recipients = [to_email]
                if cc:
                    recipients.extend(cc)
                server.sendmail(msg["From"], recipients, msg.as_string())
            return True
        except Exception:
            return False

    def send_text_email(self, to_email: str, subject: str, body: str) -> bool:
        """发送纯文本邮件"""
        if not self.enabled:
            return False
        try:
            msg = MIMEText(body, "plain", "utf-8")
            msg["From"] = self.smtp_username
            msg["To"] = to_email
            msg["Subject"] = subject
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(msg["From"], [to_email], msg.as_string())
            return True
        except Exception:
            return False


email_service = EmailService()
__all__ = ["EmailService", "email_service"]
