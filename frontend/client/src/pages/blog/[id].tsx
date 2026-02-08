import { useRoute } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, User, Share2, ArrowRight, ChevronDown, CheckCircle2, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { blogPosts } from "../blog/blog-data";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup } from "@/components/SEO";
import { TableOfContents } from "@/components/TableOfContents";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ShareButtons } from "@/components/ShareButtons";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { BlogFeaturedImage } from "@/components/BlogFeaturedImage";
import { useRef, useState } from "react";

export default function BlogPost() {
  const [, params] = useRoute("/blog/:id");
  const [, setLocation] = useLocation();
  const postId = params?.id ? parseInt(params.id) : null;
  const post = postId ? blogPosts.find((p) => p.id === postId) : null;
  const contentRef = useRef<HTMLElement>(null);
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  // SEO
  useSEO({
    title: post ? `${post.title} | Ensured Blog` : "Blog Article | Ensured",
    description: post ? post.excerpt : "Insurance insights and guides",
    keywords: post ? `${post.category.toLowerCase()}, insurance, ${post.title.toLowerCase()}` : "insurance blog",
    canonical: post ? `/blog/${post.id}` : "/blog",
  });

  if (!post) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col">
        <Header />
        <Breadcrumbs items={[{ label: "Blog" }]} />
        <main className="relative z-10 flex-1 max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-3xl font-bold font-serif mb-4 text-[var(--color-text-main)]">Article Not Found</h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            The article you're looking for doesn't exist.
          </p>
          <Button asChild className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white">
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  // Article Schema
  const articleSchema = post ? {
    headline: post.title,
    description: post.excerpt,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    datePublished: post.date,
    dateModified: post.date,
    publisher: {
      "@type": "Organization",
      name: "Ensured",
      logo: {
        "@type": "ImageObject",
        url: "https://ensured.com/favicon.png",
      },
    },
  } : null;

  // Get related articles
  const relatedArticles = blogPosts
    .filter((p) => p.id !== post.id && (p.category === post.category || p.insuranceType === post.insuranceType))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col relative">
      {/* Reading Progress Bar */}
      <ReadingProgress />

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-[var(--color-green-primary)]/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-[var(--color-green-secondary)]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {articleSchema && <SchemaMarkup type="Article" data={articleSchema} />}

      <Header />

      {/* Sticky Breadcrumb */}
      <div className="sticky top-16 z-30 bg-[var(--color-cream-main)]/95 backdrop-blur-sm border-b border-[var(--color-border-light)]">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <Breadcrumbs items={[{ label: "Blog", href: "/blog" }, { label: post.category }, { label: post.title }]} />
        </div>
      </div>

      {/* TOC Sidebar */}
      <TableOfContents contentRef={contentRef} />

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-6 py-8 md:py-12 w-full">
        <div className="grid lg:grid-cols-[280px_1fr_280px] gap-8">
          {/* Left spacer for TOC (desktop) */}
          <div className="hidden lg:block"></div>

          {/* Main Article Content */}
          <div className="min-w-0 max-w-full">
            {/* Back Button */}
            <Link href="/blog">
              <Button variant="ghost" className="mb-6 text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blog
              </Button>
            </Link>

            {/* Article Header with Featured Image */}
            <div className="mb-12">
              {/* Featured Image */}
              <div className="relative h-[250px] md:h-[400px] rounded-t-2xl overflow-hidden bg-gradient-to-br from-[var(--color-cream-dark)] to-[var(--color-border-light)] mb-0">
                {/* Generate styled preview card matching Analysis Report design */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="w-full max-w-4xl">
                    <BlogFeaturedImage
                      articleId={post.id}
                      category={post.category}
                      title={post.title}
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                  <div className="max-w-3xl">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase mb-4 bg-white/90 text-[var(--color-green-primary)] shadow-sm`}>
                      {post.category}
                    </span>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold font-serif text-white mb-0 leading-tight drop-shadow-md">
                      {post.title}
                    </h1>
                  </div>
                </div>
              </div>

              {/* Subheading and Metadata */}
              <div className="bg-white rounded-b-2xl border-x border-b border-[var(--color-border-light)] p-8 md:p-12 shadow-sm">
                <p className="text-lg md:text-xl text-[var(--color-text-secondary)] leading-relaxed mb-6 max-w-3xl font-light">
                  {post.excerpt}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{post.readTime}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>By {post.author}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Article Content */}
            <article ref={contentRef} className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] p-8 md:p-12 mb-12">

              {/* Content */}
              <div className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-[var(--color-text-main)] prose-p:text-[var(--color-text-secondary)] prose-strong:text-[var(--color-text-main)] prose-a:text-[var(--color-green-primary)] hover:prose-a:text-[var(--color-green-primary)] prose-li:text-[var(--color-text-secondary)]">
                {post.content ? (
                  <div
                    className="blog-content space-y-6 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                ) : (
                  <div className="text-[var(--color-text-muted)]">
                    <p className="text-lg mb-4">{post.excerpt}</p>
                    <p className="mt-4 italic">Full article content coming soon...</p>
                  </div>
                )}
              </div>

              {/* CTA Section */}
              <div className="mt-12 pt-8 border-t border-[var(--color-border-light)]">
                <div className="bg-[var(--color-cream-dark)] rounded-xl p-6 border-l-4 border-[var(--color-green-primary)]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold font-serif text-[var(--color-text-main)] mb-2">Want to understand your specific policy?</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Upload your policy PDF and see exactly what your room limit is and how it affects claims.
                      </p>
                    </div>
                    <Button
                      onClick={() => setLocation("/policychecker")}
                      className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white font-semibold h-10 px-6 whitespace-nowrap"
                    >
                      Analyze Your Policy
                    </Button>
                  </div>
                </div>
              </div>

              {/* FAQ Section */}
              {post.faqs && post.faqs.length > 0 && (
                <div className="mt-12 pt-8 border-t border-[var(--color-border-light)]">
                  <h2 className="text-2xl md:text-3xl font-bold text-center font-serif text-[var(--color-text-main)] mb-8">
                    Frequently Asked Questions
                  </h2>
                  <div className="space-y-0">
                    {post.faqs.map((faq, index) => (
                      <details
                        key={index}
                        className="border-b border-[var(--color-border-light)] last:border-b-0"
                        open={activeFAQ === index}
                        onToggle={(e) => setActiveFAQ(e.currentTarget.open ? index : null)}
                      >
                        <summary className="py-4 px-0 cursor-pointer flex items-center justify-between text-sm font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] rounded-lg px-3 transition-colors">
                          <span>{faq.question}</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${activeFAQ === index ? 'transform rotate-180' : ''}`} />
                        </summary>
                        <div className="pb-4 px-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          <p>{faq.answer}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Author Bio */}
              <div className="mt-12 pt-8 border-t border-[var(--color-border-light)]">
                <div className="bg-[var(--color-cream-dark)] rounded-xl p-6">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-full bg-white border border-[var(--color-border-light)] flex items-center justify-center flex-shrink-0 text-[var(--color-green-primary)] font-serif text-2xl font-bold">
                      E
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-main)] mb-1">Ensured Team</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        We decode insurance so you don't have to. Health, life, vehicle—everything explained clearly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {/* Newsletter Signup */}
              <NewsletterSignup compact />

              {/* Share Buttons */}
              <div className="bg-white border border-[var(--color-border-light)] rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-text-main)] mb-3">Share</h3>
                <ShareButtons url={typeof window !== "undefined" ? window.location.href : ""} title={post.title} description={post.excerpt} compact />
              </div>

              {/* Article Stats */}
              {post.readCount && (
                <div className="bg-white border border-[var(--color-border-light)] rounded-xl p-5 shadow-sm">
                  <div className="space-y-3 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{(post.readCount / 1000).toFixed(1)}K people read this</span>
                    </div>
                    {post.helpfulPercentage && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{post.helpfulPercentage}% found it helpful</span>
                      </div>
                    )}
                    {post.sharesCount && (
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4" />
                        <span>{post.sharesCount} shares</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Related Articles (Mini) */}
              {relatedArticles.length > 0 && (
                <div className="bg-white border border-[var(--color-border-light)] rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-[var(--color-text-main)] mb-3">Related Articles</h3>
                  <div className="space-y-3">
                    {relatedArticles.map((relatedPost) => {
                      const Icon = relatedPost.icon;
                      return (
                        <Link key={relatedPost.id} href={`/blog/${relatedPost.id}`}>
                          <div className="flex gap-3 p-2 rounded-lg hover:bg-[var(--color-cream-dark)] transition-colors cursor-pointer group">
                            <div className="w-12 h-12 rounded-lg bg-[var(--color-white)] border border-[var(--color-border-light)] flex items-center justify-center flex-shrink-0 group-hover:border-[var(--color-green-primary)] transition-colors">
                              <Icon className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-green-primary)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-[var(--color-text-main)] line-clamp-2 leading-snug group-hover:text-[var(--color-green-primary)]">
                                {relatedPost.title}
                              </h4>
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">{relatedPost.readTime}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share & CTA Section */}
        <div className="max-w-4xl mx-auto px-6 py-8 border-t border-[var(--color-border-light)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <ShareButtons url={typeof window !== "undefined" ? window.location.href : ""} title={post.title} description={post.excerpt} />
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">Not ready to leave?</p>
              <Link href="/blog" className="text-xs text-[var(--color-green-primary)] hover:underline">
                Read more on {post.category} →
              </Link>
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-[var(--color-petrol-900)] rounded-xl p-8 text-center text-white shadow-lg">
            <h3 className="text-xl font-bold mb-3 font-serif">Ready to Analyze Your Policy?</h3>
            <Button
              onClick={() => setLocation("/policychecker")}
              className="bg-white hover:bg-[var(--color-cream-main)] text-[var(--color-petrol-900)] font-semibold h-12 px-8"
            >
              Start Analysis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Link href="/" className="block mt-4 text-sm text-white/70 hover:text-white">
              Explore all tools →
            </Link>
          </div>
        </div>

        {/* Related Articles - Full Section */}
        {relatedArticles.length > 0 && (
          <div className="max-w-4xl mx-auto px-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 font-serif text-[var(--color-text-main)]">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedArticles.map((relatedPost) => {
                const Icon = relatedPost.icon;
                return (
                  <Link key={relatedPost.id} href={`/blog/${relatedPost.id}`}>
                    <div className="bg-white rounded-xl overflow-hidden border border-[var(--color-border-light)] hover:shadow-lg transition-all duration-200 cursor-pointer h-full flex flex-col hover:border-[var(--color-green-secondary)]">
                      <div className="h-[150px] bg-gradient-to-br from-[var(--color-cream-dark)] to-[var(--color-border-light)] flex items-center justify-center">
                        <Icon className="w-12 h-12 text-[var(--color-text-muted)] opacity-50" />
                      </div>
                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="text-sm font-semibold text-[var(--color-text-main)] mb-2 leading-snug line-clamp-2 hover:text-[var(--color-green-primary)] transition-colors">
                          {relatedPost.title}
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2 flex-grow">
                          {relatedPost.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mt-auto pt-3 border-t border-[var(--color-border-light)]">
                          <span>{relatedPost.readTime}</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

