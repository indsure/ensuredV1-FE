// SYNTHETIC policy pack for the general benefit-illustration reader tests. A made-up
// insurer and plan ("Sample Money Back Plan", UIN 999N001V01, not a real product),
// placeholder holder details, and invented figures:
//   premium 50,000 a year for 10 years, term 20 years, from 1 Apr 2021;
//   payouts of 75,000 in years 5, 10 and 15; maturity 2,50,000 in year 20;
//   death benefit the higher of 5,00,000 and 105% of premiums paid;
//   GSV = factor x premiums paid, less payouts paid, never below 0.

const FACTOR = [0, 30, 35, 50, 50, 50, 50, 55, 60, 65, 70, 72, 74, 76, 78, 80, 82, 85, 88, 90];
export function figures() {
  const out = [];
  let cum = 0, paidOut = 0;
  for (let y = 1; y <= 20; y++) {
    const premium = y <= 10 ? 50000 : 0;
    cum += premium;
    const survival = y % 5 === 0 && y < 20 ? 75000 : 0;
    paidOut += survival;
    const maturity = y === 20 ? 250000 : 0;
    const death = Math.max(500000, Math.round(1.05 * cum));
    const gsv = y === 20 ? 0 : Math.max(0, Math.round((FACTOR[y - 1] / 100) * cum - paidOut));
    out.push({ y, premium, cum, survival, maturity, death, gsv, ssv: Math.round(gsv * 1.1) });
  }
  return out;
}

const fmt = (n) => (n === 0 ? "0" : n.toLocaleString("en-IN"));

export function genericPages(variant = {}) {
  const rows = figures().filter((r) => !(variant.gapYear && r.y === variant.gapYear));
  const schedule = [
    `<h1>Sample Life Insurance Company Limited</h1>`,
    `<p>Sample Money Back Plan (UIN: 999N001V01)</p>`,
    `<p>Name of the Policyholder : SYNTHETIC TEST HOLDER</p>`,
    `<p>Policy Number : SYN-POL-3307</p>`,
    `<p>Address : 1 Example Road, Testville</p>`,
    `<p>Date of Commencement of Policy : 01/04/2021</p>`,
    `<p>Sum Assured : Rs. 5,00,000</p>`,
  ];
  let cols;
  if (variant.reordered) {
    cols = [
      ["Policy Year", (r) => r.y], ["Guaranteed Surrender Value (GSV)", (r) => fmt(r.gsv)], ["Death Benefit", (r) => fmt(r.death)],
      ["Annualised Premium", (r) => fmt(r.premium)], ["Money Back (Survival Benefit)", (r) => fmt(r.survival)], ["Maturity Benefit", (r) => fmt(r.maturity)],
    ];
  } else {
    cols = [
      ["Policy Year", (r) => r.y], ["Annualized Premium", (r) => fmt(r.premium)], ["Cumulative Premium", (r) => fmt(r.cum)],
      ["Survival Benefit", (r) => fmt(r.survival)], ["Maturity Benefit", (r) => fmt(r.maturity)], ["Death Benefit", (r) => fmt(r.death)],
      ...(variant.noGsv ? [] : [["Guaranteed Surrender Value", (r) => fmt(r.gsv)]]),
      ...(variant.twoGsv ? [["Guaranteed Surrender Value (Option B)", (r) => fmt(r.gsv)]] : []),
      ["Non Guaranteed Special Surrender Value", (r) => fmt(r.ssv)],
    ];
  }
  const align = variant.reordered ? "right" : "center";
  const table = `<table class="ill" style="text-align:${align}"><thead><tr>${cols.map(([h]) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${cols.map(([, f]) => `<td>${f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const illustration = variant.noIllustration
    ? [`<h2>Benefits</h2>`, `<p>Payouts of 15% of the sum assured at the end of years 5, 10 and 15, and 50% at maturity.</p>`]
    : [`<h2>Benefit Illustration</h2>`, `<p>(Amount in Rupees) All premiums are assumed to be paid.</p>`, table];
  return [{ blocks: schedule }, { blocks: illustration }];
}

export const GENERIC_CSS = `
  @page { size: A4; margin: 0 }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0 }
  .page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 18mm 14mm; page-break-after: always; }
  h1 { font-size: 15px } h2 { font-size: 13px }
  p { margin: 3px 0 }
  table.ill { border-collapse: collapse; width: 100%; font-size: 9.5px }
  table.ill th { font-weight: bold; padding: 3px 4px; width: 11%; vertical-align: bottom; text-align: center }
  table.ill td { padding: 2px 4px }
`;
