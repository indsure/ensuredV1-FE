import fs from 'fs';
let c = fs.readFileSync('scripts/scaffold-api.mjs', 'utf8');
c = c.replace(/\\`/g, '`').replace(/\\\${/g, '${');
fs.writeFileSync('scripts/scaffold-api.mjs', c);
console.log("Fixed escaping.");
