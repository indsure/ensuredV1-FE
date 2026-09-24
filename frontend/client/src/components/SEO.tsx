import { useEffect } from "react";

interface SchemaMarkupProps {
  type: "Organization" | "FAQPage" | "WebSite" | "Article" | "Person" | "ProfilePage" | "DefinedTerm" | "BreadcrumbList" | "CollectionPage";
  data: any;
}

export function SchemaMarkup({ type, data }: SchemaMarkupProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    // The prerender (scripts/prerender.mjs) gives its copy of this type the same
    // id, so the removal below replaces it rather than leaving two copies.
    script.id = `schema-${type.toLowerCase()}`;
    
    const schema = {
      "@context": "https://schema.org",
      "@type": type,
      ...data,
    };
    
    script.textContent = JSON.stringify(schema);
    
    // Remove existing schema of this type
    const existing = document.getElementById(script.id);
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(script);
    
    return () => {
      const toRemove = document.getElementById(script.id);
      if (toRemove) {
        toRemove.remove();
      }
    };
  }, [type, data]);
  
  return null;
}

// FAQ Schema helper
export function createFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
