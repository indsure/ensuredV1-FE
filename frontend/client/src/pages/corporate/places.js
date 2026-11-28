// City -> state and country, so typing a city fills the other two. Picking from the suggestions is
// optional: any city can be typed, and State and Country stay editable.
const IN = (state, cities) => cities.map((city) => [city, state, "India"]);
const ROWS = [
  ...IN("Maharashtra", ["Mumbai", "Navi Mumbai", "Thane", "Pune", "Nashik", "Nagpur", "Aurangabad", "Chhatrapati Sambhajinagar", "Kolhapur", "Solapur", "Sangli", "Satara", "Jalgaon", "Amravati", "Akola", "Latur", "Nanded", "Ahmednagar", "Bhiwandi", "Kalyan", "Vasai", "Panvel", "Raigad", "Ratnagiri", "Palghar", "Lonavala", "Baramati"]),
  ...IN("Gujarat", ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Bharuch", "Ankleshwar", "Vapi", "Valsad", "Navsari", "Mehsana", "Morbi", "Gandhidham", "Kandla", "Mundra", "Bhuj", "Porbandar", "Pipavav", "Hazira", "Dahej"]),
  ...IN("Delhi", ["Delhi", "New Delhi"]),
  ...IN("Haryana", ["Gurugram", "Gurgaon", "Faridabad", "Panipat", "Sonipat", "Ambala", "Karnal", "Hisar", "Rohtak", "Bahadurgarh", "Manesar"]),
  ...IN("Uttar Pradesh", ["Noida", "Greater Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Allahabad", "Meerut", "Aligarh", "Bareilly", "Moradabad", "Gorakhpur", "Mathura", "Firozabad", "Jhansi", "Saharanpur"]),
  ...IN("Rajasthan", ["Jaipur", "Udaipur", "Jodhpur", "Kota", "Ajmer", "Bikaner", "Alwar", "Bhilwara", "Bhiwadi", "Neemrana"]),
  ...IN("Punjab", ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Rajpura"]),
  ...IN("Chandigarh", ["Chandigarh"]),
  ...IN("Himachal Pradesh", ["Shimla", "Baddi", "Solan", "Dharamshala"]),
  ...IN("Uttarakhand", ["Dehradun", "Haridwar", "Rudrapur", "Roorkee", "Haldwani"]),
  ...IN("Jammu and Kashmir", ["Jammu", "Srinagar"]),
  ...IN("Madhya Pradesh", ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Pithampur", "Dewas", "Sagar"]),
  ...IN("Chhattisgarh", ["Raipur", "Bhilai", "Durg", "Bilaspur", "Korba"]),
  ...IN("Karnataka", ["Bengaluru", "Bangalore", "Mysuru", "Mysore", "Mangaluru", "Mangalore", "Hubballi", "Hubli", "Dharwad", "Belagavi", "Belgaum", "Kalaburagi", "Davanagere", "Ballari", "Tumakuru", "Udupi", "Hosur Road"]),
  ...IN("Tamil Nadu", ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Trichy", "Salem", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Tuticorin", "Tirunelveli", "Hosur", "Ennore", "Kanchipuram", "Sriperumbudur"]),
  ...IN("Kerala", ["Kochi", "Cochin", "Ernakulam", "Thiruvananthapuram", "Trivandrum", "Kozhikode", "Calicut", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Palakkad", "Kottayam"]),
  ...IN("Telangana", ["Hyderabad", "Secunderabad", "Warangal", "Karimnagar", "Nizamabad"]),
  ...IN("Andhra Pradesh", ["Visakhapatnam", "Vizag", "Vijayawada", "Guntur", "Nellore", "Tirupati", "Kakinada", "Krishnapatnam", "Kurnool", "Anantapur", "Rajahmundry"]),
  ...IN("West Bengal", ["Kolkata", "Calcutta", "Howrah", "Durgapur", "Asansol", "Siliguri", "Haldia", "Kharagpur"]),
  ...IN("Odisha", ["Bhubaneswar", "Cuttack", "Rourkela", "Paradip", "Sambalpur", "Berhampur", "Jharsuguda", "Angul"]),
  ...IN("Bihar", ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"]),
  ...IN("Jharkhand", ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"]),
  ...IN("Assam", ["Guwahati", "Dibrugarh", "Silchar"]),
  ...IN("Goa", ["Goa", "Panaji", "Panjim", "Margao", "Vasco da Gama", "Mormugao"]),
  ...IN("Puducherry", ["Puducherry", "Pondicherry"]),
  ...IN("Dadra and Nagar Haveli and Daman and Diu", ["Silvassa", "Daman"]),
  ["Dubai", "Dubai", "UAE"], ["Abu Dhabi", "Abu Dhabi", "UAE"], ["Sharjah", "Sharjah", "UAE"], ["Jebel Ali", "Dubai", "UAE"],
  ["Singapore", "", "Singapore"], ["Colombo", "Western Province", "Sri Lanka"], ["Dhaka", "Dhaka", "Bangladesh"], ["Chittagong", "Chattogram", "Bangladesh"],
  ["Kathmandu", "Bagmati", "Nepal"], ["Hong Kong", "", "Hong Kong"], ["London", "England", "United Kingdom"], ["Rotterdam", "South Holland", "Netherlands"],
  ["Antwerp", "Antwerp", "Belgium"], ["Hamburg", "Hamburg", "Germany"], ["Doha", "", "Qatar"], ["Muscat", "Muscat", "Oman"], ["Riyadh", "Riyadh", "Saudi Arabia"],
  ["Jeddah", "Makkah", "Saudi Arabia"], ["Port Klang", "Selangor", "Malaysia"], ["Kuala Lumpur", "", "Malaysia"], ["Shanghai", "Shanghai", "China"],
  ["New York", "New York", "United States"], ["Houston", "Texas", "United States"], ["Oslo", "Oslo", "Norway"],
];
const BY_CITY = new Map(ROWS.map(([city, state, country]) => [city.toLowerCase(), { city, state, country }]));

// Mumbai localities often appear where a city is expected ("Andheri", "Vile Parle").
const MUMBAI = ["andheri", "bandra", "bkc", "borivali", "chembur", "colaba", "dadar", "fort", "ghatkopar", "goregaon", "juhu", "kandivali", "kurla", "lower parel", "malad", "mulund", "nariman point", "parel", "powai", "prabhadevi", "santacruz", "sion", "tardeo", "vikhroli", "vile parle", "worli"];

/** The state and country of a city, or null when the city is not in the list. */
export function placeOf(city) {
  const key = String(city || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (BY_CITY.has(key)) return BY_CITY.get(key);
  if (MUMBAI.includes(key)) return { city: "Mumbai", state: "Maharashtra", country: "India" };
  return null;
}
export { COUNTRIES } from "./countries.js";

// ---- The whole world, from GeoNames (every place of about 1,000 people or more).
// The file is large, so it loads the first time someone types a city, not with the page.
let world = null;
export function loadWorld() {
  if (!world) world = import("./world-cities.json").then((m) => {
    const d = m.default || m;
    const rows = d.rows.split("\n").map((l) => {
      const [name, ascii, a, c] = l.split("|");
      return { name, key: (ascii || name).toLowerCase(), alt: ascii ? name.toLowerCase() : "", state: d.admins[+a], country: d.countries[+c] };
    });
    return rows;
  }).catch((e) => { world = null; throw e; });
  return world;
}
const same = (a, b) => a.city.toLowerCase() === b.city.toLowerCase() && a.state === b.state && a.country === b.country;

/** Up to "limit" places starting with what was typed: exact names first, then the largest places. */
export async function searchCities(q, limit = 8) {
  const key = String(q || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (key.length < 2) return [];
  const out = [];
  const add = (r) => { if (!out.some((x) => same(x, r))) out.push(r); };
  for (const [city, state, country] of ROWS) if (city.toLowerCase() === key) add({ city, state, country });
  const rows = await loadWorld();
  const exact = [], starts = [];
  for (const r of rows) {
    if (r.key === key || r.alt === key) exact.push(r);
    else if (starts.length < limit && (r.key.startsWith(key) || r.alt.startsWith(key))) starts.push(r);
  }
  for (const r of [...exact, ...starts]) add({ city: r.name, state: r.state, country: r.country });
  return out.slice(0, limit);
}
/** The state and country of a city anywhere: our own list first, then the largest place of that name. */
export async function lookupPlace(city) {
  const own = placeOf(city);
  if (own) return own;
  const key = String(city || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (key.length < 2) return null;
  const rows = await loadWorld();
  const r = rows.find((x) => x.key === key || x.alt === key);
  return r ? { city: r.name, state: r.state, country: r.country } : null;
}
