
const line = "Institute Of Medical Science & Sum Hospital Bhubaneswar";
const trimmed = line.trim();

console.log(`Line: "${line}"`);
console.log(`Trimmed: "${trimmed}"`);

// Current Regex from hospital_segmenter.ts
// const isHospitalName = /^[A-Za-z0-9 .&'()]+(Hospital|Hospitals|Nursing Home|Clinic|Eye Care|Maternity|General Hospital|Medical Centre|Multi Speciality)(?:[\s,.-]+[A-Za-z0-9 ()&'.]+)?$/i.test(trimmed);

const regex = /^[A-Za-z0-9 .&'()]+(Hospital|Hospitals|Nursing Home|Clinic|Eye Care|Maternity|General Hospital|Medical Centre|Multi Speciality)(?:[\s,.-]+[A-Za-z0-9 ()&'.]+)?$/i;

console.log("Regex Source:", regex.source);
console.log("Test Result:", regex.test(trimmed));

if (!regex.test(trimmed)) {
    console.log("Match Failed!");
    // Debug parts
    const prefix = trimmed.match(/^[A-Za-z0-9 .&'()]+/);
    console.log("Prefix match:", prefix ? prefix[0] : "null");

    // Check keyword
    const keyword = trimmed.match(/(Hospital|Hospitals|Nursing Home|Clinic|Eye Care|Maternity|General Hospital|Medical Centre|Multi Speciality)/i);
    console.log("Keyword match:", keyword ? keyword[0] : "null");
}
