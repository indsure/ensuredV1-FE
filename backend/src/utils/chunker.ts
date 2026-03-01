import { RAG_CONFIG } from "../config";

export interface Chunk {
  sectionTitle: string | null;
  chunkIndex: number;
  chunkText: string;
  charCount: number;
  hasOverlap: boolean;
}

// Section header detection patterns (Indian insurance document conventions)
const SECTION_PATTERNS = [
  /^SECTION\s+\d+/im,
  /^(?:Clause|Article)\s+\d+/im,
  /^\d+\.\d+\.?\s+[A-Z]/m,
  /^(?:PART|CHAPTER|SCHEDULE)\s+/im,
  /^\*(?:Proviso|Condition|Exception)/im,
];

const SECTION_HEADER_REGEX = new RegExp(
  SECTION_PATTERNS.map((p) => p.source).join("|"),
  "im"
);

/**
 * Semantic-aware chunker for insurance policy documents.
 * Split priority: section headers > clause boundaries > paragraph breaks > sentence ends > hard cut.
 */
export function chunkDocument(
  text: string,
  options?: {
    maxChunkSize?: number;
    minChunkSize?: number;
    overlap?: number;
  }
): Chunk[] {
  const maxSize = options?.maxChunkSize || RAG_CONFIG.policy.maxChunkChars;
  const minSize = options?.minChunkSize || RAG_CONFIG.policy.minChunkChars;
  const overlap = options?.overlap || RAG_CONFIG.policy.chunkOverlap;

  // Step 1: Split on section headers
  const sections = splitOnSections(text);

  // Step 2: Sub-split oversized sections
  const rawChunks: { title: string | null; text: string }[] = [];

  for (const section of sections) {
    if (section.text.length <= maxSize) {
      rawChunks.push(section);
    } else {
      // Sub-split on clause boundaries, then paragraphs, then sentences
      const subChunks = subSplit(section.text, maxSize);
      for (const sub of subChunks) {
        rawChunks.push({ title: section.title, text: sub });
      }
    }
  }

  // Step 3: Merge tiny chunks with next chunk
  const mergedChunks: { title: string | null; text: string }[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    if (
      rawChunks[i].text.length < minSize &&
      i + 1 < rawChunks.length &&
      rawChunks[i].text.length + rawChunks[i + 1].text.length <= maxSize
    ) {
      // Merge with next
      rawChunks[i + 1] = {
        title: rawChunks[i].title || rawChunks[i + 1].title,
        text: rawChunks[i].text + "\n" + rawChunks[i + 1].text,
      };
    } else {
      mergedChunks.push(rawChunks[i]);
    }
  }

  // Step 4: Add overlap and produce final chunks
  const chunks: Chunk[] = [];
  for (let i = 0; i < mergedChunks.length; i++) {
    let chunkText = mergedChunks[i].text;
    let hasOverlap = false;

    if (i > 0 && overlap > 0) {
      const prevText = mergedChunks[i - 1].text;
      const overlapText = prevText.slice(-overlap);
      chunkText = overlapText + chunkText;
      hasOverlap = true;
    }

    chunks.push({
      sectionTitle: mergedChunks[i].title,
      chunkIndex: i,
      chunkText,
      charCount: chunkText.length,
      hasOverlap,
    });
  }

  return chunks;
}

function splitOnSections(
  text: string
): { title: string | null; text: string }[] {
  const lines = text.split("\n");
  const sections: { title: string | null; text: string }[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (SECTION_HEADER_REGEX.test(line.trim())) {
      // Save previous section
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          text: currentLines.join("\n").trim(),
        });
      }
      currentTitle = line.trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      text: currentLines.join("\n").trim(),
    });
  }

  return sections.filter((s) => s.text.length > 0);
}

function subSplit(text: string, maxSize: number): string[] {
  // Try clause boundaries first
  const clauseChunks = splitOnPattern(text, /\n(?=\d+\.\d+\.?\s)/m, maxSize);
  if (clauseChunks.every((c) => c.length <= maxSize)) return clauseChunks;

  // Try paragraph breaks
  const paraChunks = splitOnPattern(text, /\n\n+/, maxSize);
  if (paraChunks.every((c) => c.length <= maxSize)) return paraChunks;

  // Try sentence ends
  const sentenceChunks = splitOnPattern(text, /(?<=\.)\s+(?=[A-Z])/, maxSize);
  if (sentenceChunks.every((c) => c.length <= maxSize)) return sentenceChunks;

  // Hard cut as last resort
  return hardSplit(text, maxSize);
}

function splitOnPattern(
  text: string,
  pattern: RegExp,
  maxSize: number
): string[] {
  const parts = text.split(pattern);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length + 1 <= maxSize) {
      current = current ? current + "\n" + part : part;
    } else {
      if (current) chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

function hardSplit(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxSize) {
    chunks.push(text.slice(i, i + maxSize));
  }
  return chunks;
}
