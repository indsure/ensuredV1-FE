import { useRoute, Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Linkedin, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup } from "@/components/SEO";
import { founderBySlug, displayName, authorForId } from "@/data/team";
import { blogPosts } from "./blog/blog-data";
import { blogPath } from "./blog/slugs";

export default function AuthorPage() {
  const [, params] = useRoute("/author/:slug");
  const founder = founderBySlug(params?.slug || "");

  useSEO({
    title: founder ? `${displayName(founder)}, ${founder.role} at IndSure` : "Author | IndSure",
    description: founder
      ? `${displayName(founder)} is ${founder.role} at IndSure. ${founder.bio.slice(0, 150)}`
      : "IndSure author profile.",
    canonical: founder ? `/author/${founder.slug}` : "/team",
  });

  if (!founder) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col">
        <Header />
        <Breadcrumbs items={[{ label: "Team", href: "/team" }, { label: "Author" }]} />
        <main className="flex-1 max-w-4xl mx-auto px-6 pt-32 pb-12 text-center">
          <h1 className="text-3xl font-bold font-serif mb-4">Author not found</h1>
          <Button asChild className="bg-[var(--color-green-primary)] text-white">
            <Link href="/team">Meet the team</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const articles = blogPosts.filter((p) => authorForId(p.id).slug === founder.slug);
  const name = displayName(founder);

  const personSchema = {
    "@type": "Person",
    name: founder.name,
    ...(founder.suffix ? { honorificSuffix: founder.suffix } : {}),
    jobTitle: founder.role,
    description: founder.bio,
    url: `https://indsure.in/author/${founder.slug}`,
    sameAs: [founder.linkedin],
    worksFor: { "@type": "Organization", name: "IndSure", url: "https://indsure.in" },
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <SchemaMarkup type="Person" data={personSchema} />
      <Header />
      <Breadcrumbs items={[{ label: "Team", href: "/team" }, { label: name }]} />

      <main className="flex-1 max-w-4xl mx-auto px-6 pt-28 md:pt-32 pb-16 w-full">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-12">
          <div className="w-24 h-24 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] flex items-center justify-center text-2xl font-serif text-[var(--color-green-primary)] shrink-0">
            {founder.initials}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-3xl md:text-4xl font-serif font-bold mb-1">{name}</h1>
            <p className="text-sm uppercase tracking-widest text-[var(--color-green-primary)] font-semibold mb-4">
              {founder.role}, IndSure
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">{founder.bio}</p>
            <a
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--color-green-primary)] hover:underline"
            >
              <Linkedin className="w-4 h-4" /> Connect on LinkedIn
            </a>
          </div>
        </div>

        {/* Articles by this author */}
        {articles.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Articles by {founder.name}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {articles.map((post) => (
                <Link key={post.id} href={blogPath(post.id)}>
                  <div className="bg-white rounded-xl border border-[var(--color-border-light)] p-5 hover:shadow-lg hover:border-[var(--color-green-secondary)] transition-all h-full flex flex-col cursor-pointer">
                    <span className="text-xs uppercase tracking-wider text-[var(--color-green-primary)] font-semibold mb-2">
                      {post.category}
                    </span>
                    <h3 className="text-base font-semibold mb-2 leading-snug line-clamp-2">{post.title}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 flex-grow">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border-light)]">
                      <span>{post.readTime}</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
