import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import { IconUsers } from "@/components/icons";
import BookingForm from "./BookingForm";

interface PublicPage {
  name: string;
  bio: string | null;
  photo_url: string | null;
}

async function fetchPage(slug: string): Promise<PublicPage | null> {
  // Lido em runtime, dentro da função (não como const de módulo) - no Worker do
  // Cloudflare (OpenNext), process.env só fica populado depois que o handler da
  // request começa a rodar. Uma const de módulo top-level captura o valor cedo
  // demais e fica presa nesse valor errado pro resto da vida do isolate.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/public/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`fetchPage: ${apiUrl}/public/${slug} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as PublicPage;
  } catch (err) {
    console.error(`fetchPage: ${apiUrl}/public/${slug} ->`, err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await fetchPage(params.slug);
  if (!page) return { title: "Página não encontrada — NutriHub" };
  const description = page.bio ?? `Agende um horário com ${page.name} pelo NutriHub.`;
  return {
    title: `${page.name} — NutriHub`,
    description,
    openGraph: {
      title: page.name,
      description,
      type: "profile",
      // Sem width/height: a imagem é redimensionada preservando proporção no servidor,
      // então daqui não dá pra saber as dimensões finais sem reabrir o arquivo —
      // declarar valor errado é pior que omitir.
      ...(page.photo_url ? { images: [{ url: page.photo_url, alt: `Foto de ${page.name}` }] } : {})
    },
    // "summary" e não "summary_large_image": o avatar é quadrado.
    ...(page.photo_url ? { twitter: { card: "summary" as const } } : {})
  };
}

export default async function PublicProfessionalPage({ params }: { params: { slug: string } }) {
  const page = await fetchPage(params.slug);

  if (!page) {
    return (
      <main className="form-container">
        <EmptyState
          icon={<IconUsers />}
          title="Página não encontrada"
          description="Esse link pode estar errado, ou o profissional desabilitou a página pública."
          actionLabel="Ir para o NutriHub"
          actionHref="/"
        />
      </main>
    );
  }

  return <BookingForm slug={params.slug} name={page.name} bio={page.bio} photoUrl={page.photo_url} />;
}
