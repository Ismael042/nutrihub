import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/paciente", "/login", "/cadastro", "/p/"],
        disallow: ["/dashboard", "/pacientes", "/agenda", "/financeiro", "/conteudo", "/exames", "/prescricoes", "/metas", "/farmacias", "/tags", "/nutriplan", "/equipe", "/configuracoes", "/locais"]
      }
    ]
  };
}
