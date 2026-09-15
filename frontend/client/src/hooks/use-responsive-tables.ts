import { useEffect } from "react";

/**
 * Article bodies are authored as raw HTML strings, so their tables arrive with
 * no styling hooks — a five-column cost table renders 444px wide inside a 327px
 * phone column and simply runs off the page.
 *
 * This walks the rendered container and gives each authored table the same
 * `table-cards` treatment used by the app's own tables: every <td> is stamped
 * with its column heading so the row can restack into a labelled card under
 * 768px. Authors keep writing plain <table> markup and get a readable mobile
 * layout for free.
 *
 * Runs after render rather than at build time on purpose: the prerendered HTML
 * that crawlers see keeps its plain, semantic table.
 */
export function useResponsiveTables(
  ref: React.RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    for (const table of Array.from(root.querySelectorAll("table"))) {
      if (table.dataset.responsiveTable === "done") continue;

      const headings = Array.from(table.querySelectorAll("thead th")).map(
        (th) => (th.textContent ?? "").trim(),
      );
      // Without headings there is nothing to label the stacked cells with, so
      // leave the table alone rather than producing unlabelled fragments.
      if (headings.length === 0) continue;

      for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
        const cells = Array.from(row.children).filter(
          (c): c is HTMLTableCellElement => c.tagName === "TD",
        );
        // A row that does not line up with the header (colspan'd notes, spacer
        // rows) would get mislabelled, so skip it.
        if (cells.length !== headings.length) continue;

        cells.forEach((cell, i) => {
          if (headings[i]) cell.setAttribute("data-label", headings[i]);
          // The leading column reads as the card's title.
          if (i === 0) cell.setAttribute("data-cell", "title");
        });
      }

      table.classList.add("table-cards");
      table.dataset.responsiveTable = "done";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
