// Shape of a DRAFT blog post. Drafts are not published; when approved, each one
// moves into the live blog data (blog-data.ts) with an id, date and icon.
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
