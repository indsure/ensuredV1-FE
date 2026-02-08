
function testLogic(line: string) {
    const trimmed = line.trim();
    console.log(`Testing: "${line}"`);
    console.log(`Trimmed: "${trimmed}"`);

    // Logic from hospital_segmenter.ts
    if (!trimmed) { console.log("Fail: Empty"); return; }
    if (!/^[A-Z]/.test(trimmed)) { console.log("Fail: Not Capital"); return; }

    if (trimmed.includes('(City -') || trimmed.includes('(City-')) {
        console.log("Fail: Includes City - (FIXED LOGIC)");
        return;
    }

    if (/(?: - |-[A-Z])/.test(trimmed)) {
        console.log("Pass: Regex Match");
        return;
    }

    console.log("Fail: No Pattern");
}

testLogic("Kandivali West (City - Mumbai) ,Mumbai,Maharashtra ,400067");
testLogic("Kirti Nursing Home-Kandivali West-Mumbai");
