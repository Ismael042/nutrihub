from fastapi import APIRouter

router = APIRouter(prefix="/diet-plans", tags=["diet-plans"])


@router.get("/{plan_id}/pdf")
def generate_pdf(plan_id: str) -> dict[str, str]:
    """Placeholder: gera o PDF do plano alimentar a partir dos dados no Supabase.

    Motivo de existir na API em vez de no Next.js: reportlab e a montagem do
    PDF são mais naturais em Python, e mantém o front livre dessa dependência.
    """
    return {"plan_id": plan_id, "status": "not_implemented"}
