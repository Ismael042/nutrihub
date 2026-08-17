import html

import httpx

from app.core.config import settings

RESEND_API_URL = "https://api.resend.com/emails"

FONT_STACK = (
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
)


def _verification_email_html(*, name: str, code: str) -> str:
    # Layout em tabela + estilo inline de propósito: é o único jeito de ter aparência
    # consistente em Outlook desktop (renderiza HTML via engine do Word, sem suporte a
    # flex/grid/gap e suporte parcial a <style> em bloco) e em clientes mobile que
    # cortam <style> agressivamente. Sem imagens externas — não existe asset de logo no
    # repo, e imagem bloqueada por padrão em boa parte dos clientes deixaria o cabeçalho
    # vazio; o wordmark de texto replica o que já é usado no site (Nutri escuro + Hub
    # verde, ver apps/web/app/page.tsx).
    safe_name = html.escape(name)
    safe_code = html.escape(code)
    return f"""\
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Confirme seu e-mail — NutriHub</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f8f6;font-family:{FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f8f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;" align="center">
                <span style="font-size:20px;font-weight:700;color:#252525;">Nutri<span style="color:#0f9d74;">Hub</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;color:#252525;font-size:15px;line-height:1.6;">
                Olá {safe_name},
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;color:#4a4a4a;font-size:15px;line-height:1.6;">
                Recebemos uma solicitação de cadastro no NutriHub com este e-mail. Use o código abaixo pra confirmar que é você.
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e7f5f0;border:1px solid #0f9d74;border-radius:10px;">
                  <tr>
                    <td align="center" style="padding:20px 16px;">
                      <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0c7b5c;">{safe_code}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;color:#6b6b6b;font-size:13px;line-height:1.6;">
                Esse código expira em 10 minutos. Se você não pediu esse cadastro, é só ignorar este e-mail — e não compartilhe esse código com ninguém, nem mesmo com alguém que diga trabalhar no NutriHub.
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e2e2e2;margin:0 0 16px 0;" />
                <span style="color:#9a9a9a;font-size:12px;">NutriHub — painel de gestão para nutricionistas</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


async def send_verification_email(*, to: str, name: str, code: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": "Confirme seu e-mail — NutriHub",
                "html": _verification_email_html(name=name, code=code),
            },
        )
        res.raise_for_status()
