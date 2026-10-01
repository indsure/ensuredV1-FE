// SYNTHETIC policy document for the ABSLI Nishchit Aayush (109N137V01) adapter
// tests. Every person-level value is invented (placeholder holder, policy
// number, address), and the premium, dates and benefit amounts are made up for
// a 1,00,000 a year policy. The GSV factor table is the product's published
// Annexure 1 (contract-level). Clause wording is cut to the sentences the
// reader uses, laid out the way the real contract prints them.

const GSV = {
  // policy term -> factor % for years 1..term (Annexure 1, product-level)
  30: [0, 30, 35, 50, 50, 50, 50, 52, 53, 55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 80, 81, 83, 85, 87, 90, 90],
  35: [0, 30, 35, 50, 50, 50, 50, 51, 53, 54, 56, 57, 59, 60, 61, 63, 64, 66, 67, 69, 70, 71, 73, 74, 76, 77, 79, 80, 81, 83, 84, 86, 87, 90, 90],
  40: [0, 30, 35, 50, 50, 50, 50, 51, 52, 54, 55, 56, 57, 58, 60, 61, 62, 63, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 77, 78, 79, 80, 82, 83, 84, 85, 86, 88, 90, 90],
  45: [0, 30, 35, 50, 50, 50, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 81, 82, 83, 84, 85, 86, 87, 88, 90, 90],
};

export function absliPages(variant = {}) {
  const uin = variant.uin ?? "109N137V01";
  const option = variant.option ?? "Long Term Income";
  const term = variant.term ?? 40;
  const gsv = { ...GSV };
  if (variant.dropGsvYear) gsv[term] = gsv[term].map((v, i) => (i + 1 === variant.dropGsvYear ? null : v));
  const p = (t) => `<p>${t}</p>`;

  const schedule = [
    `<h1>ABSLI Nishchit Aayush Plan Part A</h1>`,
    p("A Non-Linked Non-Participating Individual Savings Life Insurance Plan Policy Preamble | Policy Schedule"),
    p("Policyholder Name : SYNTHETIC TEST HOLDER"),
    p("Address : 1 Example Road, Testville"),
    p(`Product Unique Identification Number : ${variant.noUin ? "" : uin} Policy Issue Date : 15/06/2022`),
    variant.secondUin ? p(`Product Unique Identification Number : ${variant.secondUin} Policy Issue Date : 15/06/2022`) : "",
    p("Policy Number : SYN-POL-9902 Risk Commencement Date : 15/06/2022"),
    p(`Premium Payment Term : 12 Years Policy Term : ${term} Years`),
    p("Deferment Period : 0 Year Premium Payment Mode : Annual(1)"),
    p(`Modal Loading Factor : ${variant.modalLoading ?? "0.00%"} Annualized Premium* : \` 100,000.00`),
    p("Installment premium : ` 104,500.00"),
    p("Last Premium due on : 15/06/2033 Total Installment Premium : ` 102,250.00"),
    p("Benefit Information"),
    p(`Benefit Option : ${option} Income Variant : Level Income with`),
    p("lumpsum Benefit"),
    p("Income Benefit : ` 3,368.00 Income Frequency : Monthly"),
    p(`First Income Benefit Payment Date : 15/07/2022 Sum Assured : \` ${variant.conflictSa ? "1,100,000.00" : "1,000,000.00"}`),
    variant.conflictSa ? p("First Income Benefit Payment Date : 15/07/2022 Sum Assured : ` 1,000,000.00") : "",
    p("Enhanced Guaranteed Lumpsum : ` 1,680,000.00 Income Benefit Factor : 42.10%"),
  ];
  const defs = [
    `<h2>PART B - DEFINITIONS</h2>`,
    p("• “Policy Anniversary” means the date corresponds numerically with the Policy Issue Date in every calendar year"),
    p("until Policy Maturity Date."),
  ];
  const partC = [
    `<h2>PART C – POLICY FEATURES, BENEFITS AND PREMIUM PAYMENT</h2>`,
    p("1. Death Benefit"), p("The Sum Assured on Death is the highest of,"), p("- Sum Assured"),
    p("- 105% of the Total Premiums Paid till the date of death"),
    p("5. Grace Period"),
    p("date, You will be given a Grace Period of 30 days (15 days in case of monthly mode) to make the payment of due"),
  ];
  const partD = [
    `<h2>PART D – POLICY TERMS AND CONDITIONS</h2>`,
    p("4. Surrender Benefits"),
    p("This Policy shall acquire a Surrender Value provided all the due Instalment Premiums for the first two Policy"),
    p("The Surrender Value payable will be equal to the higher of Guaranteed Surrender Value and Special Surrender"),
    p("The Guaranteed Surrender Value (GSV) is defined as:"),
    p("− GSV Factor * Total Premiums Paid; less"),
    p("− Any Survival Benefit already paid"),
    p("5. Policy Loan"),
    p("Rs.5,000 and the maximum is 80% of the then applicable Surrender Value less any outstanding Policy loan"),
  ];
  const cols = [30, 35, 40, 45];
  const rows = [];
  for (let y = 1; y <= 45; y++) {
    rows.push(`<tr><td class="yr">${y}</td>${cols.map((c) => { const v = gsv[c][y - 1]; return `<td class="n">${v === undefined || v === null ? "" : v + "%"}</td>`; }).join("")}</tr>`);
  }
  const annexure = [
    `<h2>ANNEXURE 1: GSV Factor (% of Total Premiums Paid)</h2>`,
    `<table class="gsv"><tr><td class="yr">Surrender</td>${cols.map((c) => `<td class="n">${c}</td>`).join("")}</tr>${rows.join("")}</table>`,
  ];
  // Illustration rows, worked out the way the insurer's illustration does (income 12 x 3,368 a year).
  const ill = [];
  const inc = 12 * 3368;
  for (let y = 1; y <= term; y++) {
    const prem = y <= 12 ? 100000 : 0;
    const cum = y <= 12 ? 100000 * y : 0;
    const fmt = (n) => (n === 0 ? "0" : n.toLocaleString("en-US"));
    const surv = variant.shortIncome && y > term - 5 ? 0 : inc;
    ill.push(`<tr><td>${[y, fmt(prem), fmt(cum), fmt(surv), y === term ? "1,680,000" : "0", fmt(surv + (y === term ? 1680000 : 0)), "1,000,000", "0", "0"].join("</td><td>")}</td></tr>`);
  }
  const illustration = [
    `<h2>Your Benefit Illustration</h2>`,
    `<table class="ill">${ill.join("")}</table>`,
  ];
  return [
    { blocks: schedule }, { blocks: defs }, { blocks: partC }, { blocks: partD }, { blocks: annexure }, { blocks: illustration },
  ];
}

export const ABSLI_CSS = `
  @page { size: A4; margin: 0 }
  body { font-family: Arial, sans-serif; font-size: 10.5px; margin: 0 }
  .page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 18mm 16mm; page-break-after: always; }
  h1 { font-size: 15px } h2 { font-size: 13px }
  p { margin: 3px 0 }
  table.gsv td { padding: 1px 0; width: 60px; } table.gsv td.yr { width: 80px }
  table.ill td { padding: 1px 6px; font-size: 9px }
`;
