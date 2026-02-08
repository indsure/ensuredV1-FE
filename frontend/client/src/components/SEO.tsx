import { useEffect } from "react";

interface SchemaMarkupProps {
  type: "Organization" | "FAQPage" | "WebSite" | "Article";
  data: any;
}

export function SchemaMarkup({ type, data }: SchemaMarkupProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
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

// Organization Schema (for homepage)
export const organizationSchema = {
  name: "Ensured",
  description: "AI-powered insurance policy analyzer. Decode your health, term life, and vehicle insurance policies in 60 seconds. Free, private, no sales.",
  url: "https://ensured.com",
  logo: "https://ensured.com/favicon.png",
  sameAs: [
    // Add social media links when available
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    email: "support@ensured.com", // Update with actual email
  },
};

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
