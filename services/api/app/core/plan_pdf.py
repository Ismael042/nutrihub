"""Renderização do PDF do plano alimentar.

Extraído porque existiam duas cópias quase idênticas (routers/diet_plans.py e
routers/patient_portal.py, esta sem a linha "Paciente:"). Com o logo entrando no
cabeçalho, manter as duas divergindo sairia caro.
"""

import io
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

LOGO_MAX_W = 4 * cm
LOGO_MAX_H = 2 * cm


def _draw_logo(pdf: Any, logo_bytes: bytes | None, x: float, top_y: float) -> float:
    """Desenha o logo e devolve o novo y. Sem logo (ou com logo ilegível), devolve o
    y original — o cabeçalho fica exatamente como era antes desta feature."""
    if not logo_bytes:
        return top_y
    try:
        from reportlab.lib.utils import ImageReader

        # ImageReader aceita URL, mas buscaria de forma síncrona dentro do handler
        # async — por isso os bytes vêm de fora, já baixados via storage.
        img = ImageReader(io.BytesIO(logo_bytes))
        iw, ih = img.getSize()
        scale = min(LOGO_MAX_W / iw, LOGO_MAX_H / ih)
        w, h = iw * scale, ih * scale
        pdf.drawImage(img, x, top_y - h, width=w, height=h, mask="auto")
        return top_y - h - 0.6 * cm
    except Exception as exc:  # noqa: BLE001
        # Logo quebrado nunca pode derrubar o download do plano.
        print(f"[plan_pdf] falha ao desenhar logo: {exc}")  # noqa: T201
        return top_y


def render_plan_pdf(detail: Any, *, logo_bytes: bytes | None = None, show_patient: bool = True) -> io.BytesIO:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4
    y = height - 2 * cm

    y = _draw_logo(pdf, logo_bytes, 2 * cm, y)

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(2 * cm, y, detail.name)
    y -= 0.8 * cm
    if show_patient:
        pdf.setFont("Helvetica", 11)
        pdf.drawString(2 * cm, y, f"Paciente: {detail.patient_name}")
        y -= 1 * cm
    else:
        y -= 0.2 * cm

    for meal in detail.meals:
        if y < 3 * cm:
            pdf.showPage()
            y = height - 2 * cm
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(2 * cm, y, meal.name)
        y -= 0.6 * cm
        pdf.setFont("Helvetica", 10)
        for item in meal.items:
            if y < 2 * cm:
                pdf.showPage()
                y = height - 2 * cm
            pdf.drawString(2.5 * cm, y, f"- {item.food_name}: {item.quantity} {item.unit}")
            y -= 0.5 * cm
        y -= 0.4 * cm

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer
