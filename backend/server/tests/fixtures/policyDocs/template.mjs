// SYNTHETIC policy document template for the Click 2 Achieve (101N186V02)
// adapter tests. Every person-level value here is invented: the holder, the
// policy number and the address are placeholders. The financial terms are the
// product's published terms for one option, needed to test the parser; they
// identify no customer. Clause wording is cut down to the sentences the
// parser reads.
//
// pages(): an array of pages; each page is { columns: 1|2, blocks: string[] }
// where a block is HTML. `variant` switches deliberate faults on for tests.

export function pages(variant = {}) {
  const uin = variant.uin ?? "101N186V02";
  const option = variant.option ?? "Dream Achiever";
  const benefit = variant.benefit ?? "Early Income";
  const gsvRamp = variant.gsvRamp ?? "50% + 40% × (Policy Year – 7) ÷ (Policy Term – 8)";
  const loanCap = variant.loanCap ?? "80%";
  const row = (l, val) => `<tr><td class="l">${l}</td><td class="v">${val}</td></tr>`;
  const total = 5;
  const foot = (n) => `<div class="foot">Page ${n} of ${total}</div>`;

  const p1 = {
    columns: 1,
    blocks: [
      `<h1>POLICY DOCUMENT- HDFC Life Click 2 Achieve</h1>`,
      variant.noUin ? "" : `<p class="c">Unique Identification Number: ${uin}</p>`,
      `<p>Your Policy is a Non Linked, Non Participating, Individual, Savings Life Insurance Plan</p>`,
      `<h2>POLICY SCHEDULE</h2>`,
      `<table>${[
        row("Name of the Policyholder", "SYNTHETIC TEST HOLDER"),
        row("Policy Number", "SYN-POL-4471"),
        row("Address", "1 Example Road, Testville"),
        row("Plan Option", option),
        row("Benefit Chosen (as per cashflow chosen at inception)", benefit),
        row("Date of Risk Commencement", "4th March 2024"),
        row("Date of Commencement of Policy", "16/03/2024"),
        row("Annualized Premium", "` 200,000.00"),
        row("Premium Due Date(s)", "4th March"),
        row("Policy Term", "15 Years"),
        row("Premium Paying Term", "7 years"),
        row("Frequency of Premium Payment", "Annual"),
      ].join("")}</table>`,
      variant.secondUin ? `<p class="c">Unique Identification Number: ${variant.secondUin}</p>` : "",
      foot(1),
    ],
  };

  const cf = (a, b, c) => `<tr><td class="l">${a}</td><td class="v">${b}</td><td class="v">${c}</td></tr>`;
  const p2 = {
    columns: 1,
    blocks: [
      `<table>${[
        row("Premium per Frequency of Premium Payment (For First Year)", "` 200,000.00"),
        row("Premium per Frequency of Premium Payment (For Second Onwards)", "` 200,000.00"),
        row("Underwriting Extra Premium per Frequency of Premium Payment", "` 0.00"),
        row("Grace Period", "30 days"),
        row("Final Premium Due Date", "04/03/2030"),
        row("Maturity Date", "04/03/2039"),
        row("First Benefit Payout Date", "04/04/2024"),
        row("Payout Frequency", "Monthly"),
        row("Payout Term", "15"),
        row("Sum Assured on Death at inception", "` 2,000,000.00"),
        row("Sum Assured on Juvenile CI at inception", "NA"),
        row("Deferral of Survival/Income Benefit", variant.deferral ?? "No"),
        row("Premium Offset", "No"),
      ].join("")}</table>`,
      `<h3>${option} - ${benefit}</h3>`,
      `<table class="cf">${[
        cf("", "Survival benefit Payment dates", "Survival Benefit Amount"),
        cf("Survival Benefit", "Every Monthly starting From 04/04/2024 Till 04/03/2039", variant.sbAmount ?? "` 3,380.00"),
        cf("", "04/03/2039", "` 1,400,000.00"),
        cf("", "Maturity benefit Payment date", "Maturity Benefit Amount"),
        cf("Maturity Benefit", "NA", "NA"),
        cf("", "Income benefit Payment dates", "Income Benefit Amount"),
        cf("Income Benefit", "NA", "NA"),
      ].join("")}</table>`,
      `<p>The Premium amount is excluding any applicable Taxes and levies on the Premium.</p>`,
      variant.duplicateSchedule ? `<table>${row("Annualized Premium", "` 250,000.00")}</table>` : "",
      foot(2),
    ],
  };

  const p3 = {
    columns: 2,
    blocks: [
      `<h2>Definitions</h2>`,
      `<p>2) Annualized Premium shall be the premium amount payable in a year chosen by the policyholder, excluding the taxes, rider premiums, underwriting extra premiums and loadings for modal premiums, if any.</p>`,
      `<p>8) Date of Risk Commencement - means the date, as stated in the Policy Schedule, on which the insurance coverage under this Policy commences;</p>`,
      `<p>12) Due Date means the date stated in the Policy Schedule for the payment of Premium.</p>`,
      `<p>17) Free Look Period means the period during which the Policyholder may return the Policy.</p>`,
      `<p>21) Policy Anniversary – means the annual anniversary of the Date of Risk Commencement;</p>`,
      `<p>23) Policy Term – means the term of the Policy as stated in the Policy Schedule.</p>`,
      `<p>24) Policy Year - is the period between two consecutive policy anniversaries. This period includes the first day and excludes the next policy anniversary day.</p>`,
      `<p>30) Risk Commencement Date - means the date, as stated in the Policy Schedule, on which the insurance coverage under this Policy commences;</p>`,
      `<p>35) Survival Benefit - means the benefit payable, as per the terms of the Policy.</p>`,
      `<p>36) Total Premiums Paid - means total of all the premiums received, excluding any extra premium, any rider premium and taxes.</p>`,
      `<p>37) UIN - means the Unique Identification Number allotted to HDFC Life Click 2 Achieve by the IRDAI.</p>`,
      foot(3),
    ],
  };

  const gsvTable = `<table class="g">
    <tr><td>Policy Year</td><td>GSV Factor</td></tr>
    <tr><td>2</td><td>30%</td></tr>
    <tr><td>3</td><td>35%</td></tr>
    <tr><td>4 to 7</td><td>50%</td></tr>
    <tr><td>8 to (Policy Term less 2)</td><td>${gsvRamp}</td></tr>
    <tr><td>(Policy Term less 1) to Policy Term</td><td>90%</td></tr>
  </table>`;

  const p4blocks = [
    `<h3>3. Payment and cessation of Premiums</h3>`,
    `<p>(5) Grace Period: A grace period of 15 days for monthly Premium paying frequency and 30 days for other Premium paying frequencies is allowed for the payment of each renewal Premium after the first Premium.</p>`,
    `<h2>Part D</h2>`,
    `<h3>1. Surrender Value</h3>`,
    `<p>The Surrender Benefit will be higher of GSV (Guaranteed Surrender Value) and SSV (Special Surrender Value).</p>`,
    `<p>The policy shall acquire a Guaranteed Surrender Value (GSV) upon the payment of at least first 2 (two) years’ premiums.</p>`,
    `<p>Guaranteed Surrender Value (GSV) = Max (GSV Factor × Total premiums paid – Survival Benefits applicable till date, 0)</p>`,
    `<p>Where, GSV factor shall be as follows:</p>`,
    variant.truncateGsv ? "" : gsvTable,
    `<p>SSV shall be calculated as the discounted value of all outstanding survival and maturity benefits, calculated using prevailing interest rates. The prevailing interest rates will be derived from yields of the 10 years G-Sec security for policy term up to 20 years and 30 years G-Sec security for policy term greater than 20 years.</p>`,
    `<p>Annualized Yield on reference government bond + k, rounded up to the nearest 25 basis points.</p>`,
    `<p>Where k = 150 basis points</p>`,
    `<p>The discount rates will be reviewed semi-annually and the change in the discount rates shall be effective from 25th February and 25th August each year.</p>`,
    `<p>Currently, SSV factors have been derived using a discount rate of 9.25% for policy terms up to 20 years as well as greater than 20 years.</p>`,
    `<h3>2. Lapsed Policies and Paid-Up policies</h3>`,
    `<p>(1) If any due Premium is unpaid upon the expiry of the grace period and your Policy has not acquired a GSV, your Policy’s status will be altered to lapsed status and the cover will cease.</p>`,
    `<p>(2) No Benefits shall be payable under a lapsed Policy.</p>`,
    `<p>(3) If any due Premium is unpaid upon the expiry of the grace period and your Policy has acquired a GSV, your Policy’s status will be altered to paid-up status.</p>`,
    `<p>Paid-up value = survival/maturity/death payout (as applicable) × Number of premiums paid ÷ Total Number of premiums payable</p>`,
    `<h3>3. Revival of the Policy</h3>`,
    `<p>Currently, the application for the revival should be made within five years from the due date of the first unpaid Premium and before the expiry of the Policy Term. The revival will be subject to satisfactory evidence of continued insurability of the Life Assured and payment of outstanding Premiums with interest.</p>`,
    `<p>The current rate of interest is 9.5% p.a.</p>`,
    `<p>Average Annualized 10-year benchmark G-Sec Yield (over last 6 months &amp; rounded up to the nearest 50 bps) + 2%. The change in revival rate shall be effective from 25th February and 25th August each year.</p>`,
    `<h3>4. Discount rate</h3>`,
    `<p>The discount rate shall be computed with reference to the prevailing interest rates derived from yields of the 10 years G-Sec security.</p>`,
    `<p>Annualized Yield on reference government bond + k, rounded up to the nearest 25 basis points. Where k = 100 basis points</p>`,
    foot(4),
  ];
  const p4 = { columns: 2, blocks: p4blocks };

  const p5 = {
    columns: 2,
    blocks: [
      `<h3>7. Deferral of Survival Benefit(s):</h3>`,
      `<p>At any point of time during the Policy, the Policyholder shall have an option to defer the survival/income benefit(s).</p>`,
      `<h3>8. Loans:</h3>`,
      `<p>• The loan amount will be subject to a maximum of ${loanCap} of the surrender value.</p>`,
      `<p>• Before any benefits are paid out, loan outstanding together with the interest thereon will be deducted and the balance amount will be payable.</p>`,
      `<p>• For other than in-force and fully paid up policies, in case the outstanding loan amount including interest exceeds 90% of surrender value, the policy shall be foreclosed after giving intimation and reasonable opportunity to the policyholder to continue the policy.</p>`,
      `<p>• For inforce and fully paid up policy, the policy shall not be foreclosed on the ground of outstanding loan amount including interest exceeding the surrender value.</p>`,
      `<p>• Once the rate of interest is decided it shall not change for the entire Policy Term</p>`,
      `<p>The interest rate on loan shall be calculated as the Average Annualised 10-year benchmark G-Sec Yield (over last 6 months &amp; rounded up to the nearest 50 bps) + 2%. The interest rate shall be reviewed half-yearly and any change in the interest rate shall be effective from 25th February and 25th August each year. In case upon review the interest rate is revised, the same shall apply until next revision. The current interest rate on loan is 9.50% p.a.</p>`,
      `<p>• Female policyholder: interest rate shall be reduced by 2%</p>`,
      `<p>• Other than female policyholders: interest rate shall be reduced by 1.5%</p>`,
      `<h3>10. Premium offset</h3>`,
      `<p>This feature gives the Policyholder an option to adjust the premium payable in the policy to the extent of benefits receivable or accrued, if any.</p>`,
      foot(5),
    ],
  };

  const out = [p1, p2, p3, p4, p5];
  return variant.reorder ? [out[0], out[1], out[3], out[2], out[4]] : out;
}

export const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
.page { width: 210mm; height: 297mm; padding: 18mm 15mm 20mm; position: relative; page-break-after: always; overflow: hidden; background: #fff; }
.page:last-child { page-break-after: auto; }
.cols { column-count: 2; column-gap: 9mm; column-fill: auto; height: 250mm; }
h1 { font-size: 14pt; text-align: center; margin: 0 0 4mm; }
h2 { font-size: 12pt; margin: 3mm 0; }
h3 { font-size: 10.5pt; margin: 2.5mm 0 1.5mm; }
p { margin: 0 0 2mm; line-height: 1.35; }
.c { text-align: center; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0; }
td { border: 0.4pt solid #444; padding: 1.4mm 2mm; vertical-align: top; }
td.l { width: 52%; }
table.g td { font-size: 9.5pt; }
.foot { position: absolute; bottom: 8mm; right: 15mm; font-size: 8pt; }
`;
