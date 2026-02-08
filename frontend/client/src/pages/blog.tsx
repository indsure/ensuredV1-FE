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
import { useSEO } from "@/hooks/use-seo";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { BlogFeaturedImage } from "@/components/BlogFeaturedImage";
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

const insuranceCategories = [
  { id: "Health Insurance", label: "Health Insurance", icon: Heart, color: "bg-green-50 text-green-700", count: blogPosts.filter(p => p.insuranceType === "Health" || p.category === "Health Insurance").length },
  { id: "Life Insurance", label: "Life Insurance", icon: Shield, color: "bg-blue-50 text-blue-700", count: blogPosts.filter(p => p.insuranceType === "Life" || p.category === "Life Insurance").length },
  { id: "Vehicle Insurance", label: "Vehicle Insurance", icon: Car, color: "bg-amber-50 text-amber-700", count: blogPosts.filter(p => p.insuranceType === "Vehicle" || p.category === "Vehicle Insurance").length },
  { id: "Home Insurance", label: "Home Insurance", icon: Home, color: "bg-rose-50 text-rose-700", count: blogPosts.filter(p => p.insuranceType === "Home" || p.category === "Home Insurance").length },
  { id: "Travel Insurance", label: "Travel Insurance", icon: Plane, color: "bg-cyan-50 text-cyan-700", count: blogPosts.filter(p => p.insuranceType === "Travel" || p.category === "Travel Insurance").length },
  { id: "Business Insurance", label: "Business Insurance", icon: Briefcase, color: "bg-purple-50 text-purple-700", count: blogPosts.filter(p => p.insuranceType === "Business" || p.category === "Business Insurance").length },
  { id: "General", label: "General", icon: BookOpen, color: "bg-gray-50 text-gray-700", count: blogPosts.filter(p => p.insuranceType === "General" || p.category === "General").length },
];

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // SEO
  useSEO({
    title: "Insurance Insights & Guides | Health Insurance Explained | Ensured",
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
  };

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
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-6 py-8 md:py-12 w-full">
        {/* Hero Section */}
        <div className="text-center mb-16 pt-8 md:pt-12">
          <h1 className="text-4xl md:text-5xl lg:text-[48px] font-bold font-serif text-[var(--color-text-main)] mb-4 leading-[1.1]">
            Insurance Knowledge Base
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Clear, honest answers to every insurance question you have
          </p>

          {/* Search Bar */}
          <div className="max-w-[500px] mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <Input
                type="text"
                placeholder="Search articles, terms, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-12 text-base bg-white border border-[var(--color-border-medium)] focus:border-[var(--color-green-primary)] focus:ring-0 rounded-xl shadow-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
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
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => handleCategoryFilter(category.id)}
                  className={
                    selectedCategory === category.id
                      ? "bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white border-0 h-8 px-4 rounded-full text-xs font-medium"
                      : "border-[var(--color-border-medium)] bg-white text-[var(--color-text-secondary)] h-8 px-4 rounded-full text-xs font-medium hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-green-primary)]"
                  }
                >
                  {category.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Featured Article */}
        {selectedCategory === "All" && searchQuery === "" && topFeaturedPost && (
          <div className="mb-16 max-w-4xl mx-auto">
            <Link href={`/blog/${topFeaturedPost.id}`}>
              <Card className="bg-white border border-[var(--color-border-light)] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer shadow-sm">
                <div className="grid md:grid-cols-[45%_55%] gap-0">
                  {/* Left: Featured Image */}
                  <div className="relative h-full min-h-[280px] md:min-h-[320px] bg-gradient-to-br from-[var(--color-green-primary)]/10 to-[var(--color-green-secondary)]/10 overflow-hidden">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-block px-3 py-1 bg-[var(--color-green-primary)] text-white text-xs font-semibold rounded-full uppercase tracking-wider">
                        FEATURED
                      </span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <BlogFeaturedImage
                        articleId={topFeaturedPost.id}
                        category={topFeaturedPost.category}
                        title={topFeaturedPost.title}
                        className="w-full h-full max-h-full"
                      />
                    </div>
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
                      <span>Written by {topFeaturedPost.author}</span>
                      <span>•</span>
                      <span>Updated {new Date(topFeaturedPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
          <div className="mb-16 bg-[var(--color-white)] rounded-2xl p-12 md:p-16 border border-[var(--color-border-light)] shadow-sm">
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
                    className="bg-[var(--color-cream-main)] rounded-xl p-6 border border-[var(--color-border-light)] hover:shadow-lg transition-all duration-200 hover:scale-105 text-center cursor-pointer hover:border-[var(--color-green-secondary)]"
                  >
                    <div className={`w-12 h-12 rounded-lg ${cat.color} flex items-center justify-center mx-auto mb-3 bg-white border border-[var(--color-border-light)]`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-main)] mb-1">
                      {cat.label}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
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
            <h2 className="text-2xl md:text-3xl font-bold font-serif mb-8 text-[var(--color-text-main)]">All Articles</h2>
          )}

          {regularPosts.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {regularPosts.map((post) => {
                  const Icon = post.icon;
                  return (
                    <Link key={post.id} href={`/blog/${post.id}`}>
                      <Card className="bg-white border border-[var(--color-border-light)] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full flex flex-col overflow-hidden shadow-sm">
                        {/* Featured Image */}
                        <div className="relative h-[200px] bg-gradient-to-br from-[var(--color-cream-dark)] to-[var(--color-border-light)] overflow-hidden">
                          <div className="absolute inset-0 p-2">
                            <BlogFeaturedImage
                              articleId={post.id}
                              category={post.category}
                              title={post.title}
                              className="w-full h-full"
                            />
                          </div>
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

              {/* Load More Button */}
              {regularPosts.length >= 12 && (
                <div className="text-center mt-12">
                  <Button variant="outline" className="h-12 px-8 border-[var(--color-border-medium)] text-[var(--color-text-secondary)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-text-main)]">
                    Load More Articles
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

        {/* Newsletter Signup */}
        {selectedCategory === "All" && searchQuery === "" && (
          <div className="mb-16">
            <NewsletterSignup />
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

