import { useEffect, useState } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLElement>;
}

export function TableOfContents({ contentRef }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!contentRef.current) return;

    const headingElements = contentRef.current.querySelectorAll("h2, h3");
    const tocItems: TOCItem[] = [];

    headingElements.forEach((heading) => {
      const id = heading.id || heading.textContent?.toLowerCase().replace(/\s+/g, "-") || "";
      if (!heading.id) {
        heading.id = id;
      }
      tocItems.push({
        id,
        text: heading.textContent || "",
        level: heading.tagName === "H2" ? 2 : 3,
      });
    });

    setHeadings(tocItems);
  }, [contentRef]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-100px 0px -66%",
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => {
      headings.forEach(({ id }) => {
        const element = document.getElementById(id);
        if (element) observer.unobserve(element);
      });
    };
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveId(id);
    }
  };

  if (headings.length === 0) return null;

  return (
    <div className="hidden lg:block fixed top-24 left-6 w-64 max-h-[calc(100vh-120px)] overflow-y-auto bg-[#FAFBFC] dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 rounded-xl p-5 z-40">
      <h3 className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC] uppercase tracking-wider mb-4">
        On This Page
      </h3>
      <nav className="space-y-1">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => handleClick(heading.id)}
            className={`block w-full text-left px-2 py-1.5 rounded text-sm transition-all duration-200 ${
              activeId === heading.id
                ? "font-semibold text-[#00B4D8] border-l-[3px] border-[#00B4D8] pl-3"
                : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#00B4D8] dark:hover:text-[#00B4D8]"
            } ${heading.level === 3 ? "ml-4 text-xs" : ""}`}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
