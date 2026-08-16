import httpx

from app.core.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_verification_email(*, to: str, name: str, code: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": "Confirme seu e-mail — NutriHub",
                "html": (
                    f"<p>Olá {name},</p>"
                    f"<p>Seu código de verificação é <strong>{code}</strong>. "
                    f"Ele expira em 10 minutos.</p>"
                ),
            },
        )
        res.raise_for_status()
