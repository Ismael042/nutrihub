import type { Metadata } from "next";
import { API_URL } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { IconUsers } from "@/components/icons";
import BookingForm from "./BookingForm";

interface PublicPage {
  name: string;
  bio: string | null;
}

async function fetchPage(slug: string): Promise<PublicPage | null> {
  try {
    const res = await fetch(`${API_URL}/public/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`fetchPage: ${API_URL}/public/${slug} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as PublicPage;
  } catch (err) {
    console.error(`fetchPage: ${API_URL}/public/${slug} ->`, err);
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
    openGraph: { title: page.name, description, type: "profile" }
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

  return <BookingForm slug={params.slug} name={page.name} bio={page.bio} />;
}
