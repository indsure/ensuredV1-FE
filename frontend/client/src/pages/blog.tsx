import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import {
  Calendar,
  Clock,
  User,
  Search,
  Star,
  AlertCircle,
  Heart,
  Shield,
  Car,
  Home,
  Plane,
  Briefcase,
  BookOpen,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { blogPosts } from "./blog/blog-data";
import { blogPath } from "./blog/slugs";
import { useSEO } from "@/hooks/use-seo";
import { BlogListingCTA } from "@/components/BlogCTA";
import { BlogCover } from "@/components/BlogCover";
import { ArrowRight } from "lucide-react";


const categories = [
  { id: "All", label: "All", icon: BookOpen },
  { id: "Health Insurance", label: "Health", icon: Heart },
  { id: "Life Insurance", label: "Life", icon: Shield },
  { id: "Vehicle Insurance", label: "Vehicle", icon: Car },
  { id: "Home Insurance", label: "Home", icon: Home },
  { id: "Travel Insurance", label: "Travel", icon: Plane },
  { id: "Business Insurance", label: "Business", icon: Briefcase },
  { id: "Education", label: "Education", icon: BookOpen },
  { id: "Tips", label: "Tips", icon: AlertCircle },
  { id: "Guide", label: "Guide", icon: BookOpen },
];

/* This grid used raw Tailwind colours (green/blue/amber/rose/cyan/purple)
   while BlogCover coloured the same categories from CATEGORY_TINTS, so one
   category was two different colours depending on where you met it — Life and
   Travel were effectively swapped between the two. Both now read the site-wide
   --lob-* tokens, which is where CATEGORY_TINTS was promoted from.

   The old `color` string also carried a `bg-*-50` that never rendered: the
   element it was spread into sets `bg-white` afterwards, so only the text
   colour ever survived. */
const insuranceCategories = [
  { id: "Health Insurance", label: "Health Insurance", icon: Heart, accent: "var(--lob-health)", wash: "var(--lob-health-wash)", count: blogPosts.filter(p => p.insuranceType === "Health" || p.category === "Health Insurance").length },
  { id: "Life Insurance", label: "Life Insurance", icon: Shield, accent: "var(--lob-life)", wash: "var(--lob-life-wash)", count: blogPosts.filter(p => p.insuranceType === "Life" || p.category === "Life Insurance").length },
  { id: "Vehicle Insurance", label: "Vehicle Insurance", icon: Car, accent: "var(--lob-motor)", wash: "var(--lob-motor-wash)", count: blogPosts.filter(p => p.insuranceType === "Vehicle" || p.category === "Vehicle Insurance").length },
  { id: "Home Insurance", label: "Home Insurance", icon: Home, accent: "var(--lob-home)", wash: "var(--lob-home-wash)", count: blogPosts.filter(p => p.insuranceType === "Home" || p.category === "Home Insurance").length },
  { id: "Travel Insurance", label: "Travel Insurance", icon: Plane, accent: "var(--lob-travel)", wash: "var(--lob-travel-wash)", count: blogPosts.filter(p => p.insuranceType === "Travel" || p.category === "Travel Insurance").length },
  { id: "Business Insurance", label: "Business Insurance", icon: Briefcase, accent: "var(--lob-business)", wash: "var(--lob-business-wash)", count: blogPosts.filter(p => p.insuranceType === "Business" || p.category === "Business Insurance").length },
  { id: "General", label: "General", icon: BookOpen, accent: "var(--lob-general)", wash: "var(--lob-general-wash)", count: blogPosts.filter(p => p.insuranceType === "General" || p.category === "General").length },
];

const PAGE_SIZE = 12;

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // SEO
  useSEO({
    title: "Insurance Insights & Guides | Health Insurance Explained | IndSure",
    description: "Expert guides, tips, and insights to help you make informed decisions about your health insurance. Learn about room limits, co-pay, exclusions, and more.",
    keywords: "insurance insights, health insurance explained, insurance guides, insurance tips, room limit explained, co-pay explained, insurance education",
    canonical: "/blog",
  });

  const filteredPosts = blogPosts.filter((post) => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPosts = blogPosts.filter((post) => post.featured);
  const regularPosts = filteredPosts.filter((post) => !post.featured);
  const topFeaturedPost = featuredPosts[0]; // Most recent featured post

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery(""); // Clear search when filtering by category
    setVisibleCount(PAGE_SIZE);
  };

  const visiblePosts = regularPosts.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      {/* Animated background elements - Keeping subtle pulses but adjusting colors to Cream theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-[var(--color-green-primary)]/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-[var(--color-green-secondary)]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <Header />
      <Breadcrumbs items={[{ label: "Blog" }]} />

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-32 sm:pt-36 md:pt-40 pb-8 md:pb-12 w-full">
        {/* Hero Section */}
        <div className="relative text-center mb-16 pt-8 md:pt-12">
          {/* Same ambient treatment as every other page hero, so the blog stops
              being the one that starts on bare cream. */}
          <div className="pointer-events-none absolute -inset-x-32 -top-24 -bottom-6 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-28 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.18), transparent 68%)" }}
            />
          </div>
          <span className="mb-5 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)]">
            The library
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-[52px] font-bold font-serif text-[var(--color-text-main)] mb-4 leading-[1.1]">
            The fine print, <span className="italic text-[var(--color-teal-600)]">explained.</span>
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Clear, honest answers to every insurance question — no jargon, no sales pitch.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mb-6 max-w-[560px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-teal-600)]" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Search articles, terms, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 rounded-2xl border border-[var(--color-border-medium)] bg-white pl-12 pr-12 text-base text-[var(--color-text-main)] shadow-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-teal-600)] focus:ring-0"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-cream-dark)]"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Found {filteredPosts.length} article{filteredPosts.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              const on = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryFilter(category.id)}
                  aria-pressed={on}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] transition-all duration-200 ${
                    on
                      ? "bg-[var(--color-teal-600)] font-bold text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.7)]"
                      : "border border-[var(--color-border-medium)] bg-white font-medium text-[var(--color-text-secondary)] hover:-translate-y-0.5 hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-700)]"
                  }`}
                >
                  <CategoryIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Article */}
        {selectedCategory === "All" && searchQuery === "" && topFeaturedPost && (
          <div className="mb-16 max-w-4xl mx-auto">
            <Link href={blogPath(topFeaturedPost.id)}>
              <Card className="bg-white border border-[var(--color-border-light)] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-[45%_55%] gap-0">
                  {/* Left: typographic cover */}
                  <div className="relative h-full min-h-[280px] md:min-h-[320px] overflow-hidden">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-block px-3 py-1 bg-[var(--color-teal-600)] text-white text-xs font-semibold rounded-full uppercase tracking-wider">
                        FEATURED
                      </span>
                    </div>
                    <BlogCover title={topFeaturedPost.title} category={topFeaturedPost.category} />
                  </div>

                  {/* Right: Content */}
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <div className="mb-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-[var(--color-cream-dark)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]`}>
                        {topFeaturedPost.category}
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold font-serif text-[var(--color-text-main)] mb-3 leading-tight">
                      {topFeaturedPost.title}
                    </h2>
                    <p className="text-base text-[var(--color-text-secondary)] leading-relaxed mb-6 font-light">
                      {topFeaturedPost.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-6 uppercase tracking-widest font-medium">
                      <span>{topFeaturedPost.readTime}</span>
                      <span>•</span>
                      <span>{new Date(topFeaturedPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <Button variant="outline" className="w-fit border-[var(--color-green-primary)] text-[var(--color-green-primary)] hover:bg-[var(--color-green-primary)] hover:text-white transition-all">
                      Read Full Article
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* Browse by Category */}
        {selectedCategory === "All" && searchQuery === "" && (
          <div className="mb-16 bg-[var(--color-white)] rounded-2xl p-6 sm:p-8 md:p-16 border border-[var(--color-border-light)] shadow-sm">
            <h2 className="text-2xl md:text-3xl font-bold text-center font-serif text-[var(--color-text-main)] mb-3">
              Browse by Insurance Type
            </h2>
            <p className="text-center text-[var(--color-text-secondary)] mb-10 font-light">
              Find articles on the type of insurance you're learning about
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {insuranceCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryFilter(cat.id)}
                    className="group relative overflow-hidden rounded-xl bg-[var(--color-cream-main)] p-6 border border-[var(--color-border-light)] text-center cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_rgba(15,23,42,0.2)]"
                    style={{ borderTopColor: cat.accent, borderTopWidth: 3 }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ backgroundColor: cat.wash }}
                      aria-hidden="true"
                    />
                    <div
                      className="relative w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: cat.wash, color: cat.accent }}
                    >
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div className="relative text-[15px] font-semibold text-[var(--color-text-main)] mb-1">
                      {cat.label}
                    </div>
                    <div className="relative text-sm text-[var(--color-text-secondary)]">
                      {cat.count} article{cat.count !== 1 ? 's' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* All Posts Grid */}
        <div className="mb-16">
          {selectedCategory !== "All" || searchQuery !== "" ? (
            <h2 className="text-2xl md:text-3xl font-bold font-serif mb-8 text-[var(--color-text-main)]">
              {searchQuery ? `Search Results (${regularPosts.length})` : `${selectedCategory} Articles`}
            </h2>
          ) : (
            <div className="mb-8 flex flex-col gap-3">
              <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)]">
                Everything we have written
              </span>
              <h2 className="font-serif text-2xl font-bold text-[var(--color-navy-900)] md:text-3xl">
                All articles
              </h2>
              <span className="rule-accent" />
            </div>
          )}

          {regularPosts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visiblePosts.map((post) => {
                  return (
                    <Link key={post.id} href={blogPath(post.id)}>
                      <Card className="bg-white border border-[var(--color-border-light)] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full flex flex-col overflow-hidden shadow-sm">
                        {/* Typographic cover */}
                        <div className="relative h-[180px] overflow-hidden border-b border-[var(--color-border-light)]">
                          <BlogCover title={post.title} category={post.category} />
                        </div>

                        <CardHeader className="p-5">
                          <CardTitle className="text-lg font-semibold font-serif text-[var(--color-text-main)] mb-2 leading-snug hover:text-[var(--color-green-primary)] transition-colors line-clamp-2">
                            {post.title}
                          </CardTitle>
                          <CardDescription className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                            {post.excerpt}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0 px-5 pb-5 border-t border-[var(--color-border-light)]">
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mt-4 uppercase tracking-wider font-medium">
                            <span>{post.readTime}</span>
                            <span>•</span>
                            <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {/* Load More (real pagination) */}
              {regularPosts.length > visibleCount && (
                <div className="text-center mt-12">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="h-12 px-8 border-[var(--color-border-medium)] text-[var(--color-text-secondary)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-text-main)]"
                  >
                    Load More Articles ({regularPosts.length - visibleCount} more)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">
                  No articles found. Try a different search or category.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Funnel close */}
        {selectedCategory === "All" && searchQuery === "" && (
          <div className="mb-16">
            <BlogListingCTA />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile bottom nav spacing */}
      <div className="md:hidden h-16" />
    </div>
  );
}

