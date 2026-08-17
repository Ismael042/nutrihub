from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Sem default proposital: a API falha ao subir se isso não estiver setado no
    # ambiente, em vez de rodar silenciosamente com um segredo previsível.
    api_secret_key: str
    database_url: str = "postgresql://nutrihub:nutrihub@db:5432/nutrihub"
    # Role sem bypass de RLS — toda rota autenticada usa esta conexão (ver
    # app/core/db.py::tenant_connection e supabase/migrations/0003_app_role_rls.sql).
    # `database_url` acima (dono das tabelas) fica restrito a app/routers/auth.py.
    tenant_database_url: str = "postgresql://nutrihub_app:nutrihub_app_dev_password@db:5432/nutrihub"
    redis_url: str = "redis://redis:6379/0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Google Identity Services — verificação do ID token em POST /auth/google.
    google_client_id: str = ""
    # Resend — envio do código de verificação de e-mail no signup (app/core/email.py).
    resend_api_key: str = ""
    email_from: str = "NutriHub <no-reply@isdev.online>"
    # Cloudflare R2 — foto de perfil da página pública (app/core/storage.py).
    # Tudo vazio = upload desabilitado: a rota responde 503 e o resto da API sobe
    # normal (dev e CI não têm credencial de bucket).
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    # Base pública do bucket, sem barra no fim. Usar domínio próprio
    # (ex: https://cdn.isdev.online) — a Cloudflare rate-limita o *.r2.dev e diz
    # explicitamente pra não usar em produção.
    r2_public_base_url: str = ""
    # Bucket privado (foto de paciente/receita, logo do consultório): sem domínio
    # público, leitura só por URL assinada com expiração. Dado sensível de saúde não
    # pode ficar acessível por link permanente.
    r2_private_bucket: str = ""
    # Lista separada por vírgula; sem default de produção proposital (só localhost
    # pra dev) — cada ambiente novo declara suas próprias origens via env.
    cors_allow_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

    @field_validator("api_secret_key")
    @classmethod
    def _reject_default_secret(cls, value: str) -> str:
        if value.strip().lower() in {"", "change-me"}:
            raise ValueError(
                "API_SECRET_KEY não pode ficar vazio ou 'change-me' — defina um valor "
                "próprio (ex: `python -c \"import secrets; print(secrets.token_hex(32))\"`)"
            )
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


settings = Settings()
