# NutriHub — API

FastAPI. Responsável só pelo que o Supabase não resolve sozinho: cálculo nutricional, geração de PDF (planos alimentares, anamneses), integrações externas.

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Docs interativas em `/docs` (Swagger) quando rodando.
