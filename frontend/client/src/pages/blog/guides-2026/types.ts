// Shape of a Phase 3 guide. blog-data.ts adds the id, date, icon and sources box.
export interface DraftPost {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  /** Keyword-sheet rows (SEO.xlsx) this post answers. */
  sheetRows: string[];
  /** HTML, same format as the live posts. */
  content: string;
  faqs: { question: string; answer: string }[];
  /** Policy wordings (with UIN and clause) and other documents relied on. */
  sources: string[];
}
