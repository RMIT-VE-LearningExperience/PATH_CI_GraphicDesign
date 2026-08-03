import PublicApp from "../components/PublicApp";

export default function SlugPage({ params }: { params: { slug: string[] } }) {
  return <PublicApp initialSlugs={params.slug} />;
}
