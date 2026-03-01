const failingLines = [
    "Kirti Nursing Home-Kandivali West-Mumbai",
    "Anurag Maternity And Surgical Nursing Home-Kandivali (W)",
    "Anand Nursing Home - Kandivali West"
];

const currentRegex = / - [A-Z]/;
const proposedRegex = /-[A-Z]/; // Relaxed: allows no spaces around hyphen

console.log("--- TESTING REGEX ---");
failingLines.forEach(line => {
    const current = currentRegex.test(line);
    const proposed = proposedRegex.test(line);
    console.log(`\nLine: "${line}"`);
    console.log(`  Current (/ - [A-Z]/): ${current ? "MATCH" : "FAIL"}`);
    console.log(`  Proposed (/-[A-Z]/):   ${proposed ? "MATCH" : "FAIL"}`);
});
