import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
}

export function useSEO({
  title,
  description,
  keywords,
  canonical,
  ogImage = "/opengraph.jpg",
  ogType = "website",
  noindex = false,
}: SEOProps) {
  useEffect(() => {
    // Update title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute("content", content);
    };

    // Description
    updateMetaTag("description", description);
    updateMetaTag("og:description", description, true);
    updateMetaTag("twitter:description", description);

    // Title
    updateMetaTag("og:title", title, true);
    updateMetaTag("twitter:title", title);

    // Keywords
    if (keywords) {
      updateMetaTag("keywords", keywords);
    }

    // OG Image
    const fullOgImage = ogImage.startsWith("http") ? ogImage : `https://ensured.com${ogImage}`;
    updateMetaTag("og:image", fullOgImage, true);
    updateMetaTag("twitter:image", fullOgImage);

    // OG Type
    updateMetaTag("og:type", ogType, true);

    // Canonical URL
    const canonicalUrl = canonical || window.location.href.split("?")[0];
    const fullCanonical = canonicalUrl.startsWith("http") ? canonicalUrl : `https://ensured.com${canonicalUrl}`;
    
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", fullCanonical);

    // Robots
    if (noindex) {
      updateMetaTag("robots", "noindex, nofollow");
    } else {
      updateMetaTag("robots", "index, follow");
    }
  }, [title, description, keywords, canonical, ogImage, ogType, noindex]);
}
