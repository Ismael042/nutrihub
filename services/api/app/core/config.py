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
