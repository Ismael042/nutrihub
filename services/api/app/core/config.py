from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_secret_key: str = "change-me"
    database_url: str = "postgresql://nutrihub:nutrihub@db:5432/nutrihub"
    redis_url: str = "redis://redis:6379/0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
