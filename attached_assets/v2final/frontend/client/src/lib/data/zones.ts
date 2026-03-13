// Generated from ICICI Lombard Complete Health Insurance official zone classification
// Source: ICICI Lombard zone-based pricing structure (state/region level)
//
// Zone A : Delhi NCR (core), Mumbai region, Haryana (excl Zone D towns),
//          Ahmedabad, Surat, Daman & Diu, Dadra & Nagar Haveli
// Zone B : Bengaluru, Chennai, Hyderabad + all Telangana, all Andhra Pradesh,
//          Pune, Kolkata, all MP, all Goa, Gujarat (excl Ahmedabad & Surat),
//          all Uttarakhand, all Chhattisgarh, Pondicherry
// Zone C : Rest of India — Rajasthan, UP (excl NCR), Punjab, Chandigarh,
//          Bihar, Jharkhand, rest of WB, rest of MH (excl Mumbai/Pune),
//          rest of Karnataka (excl Bengaluru), TN (excl Chennai/Pondi),
//          Kerala, Odisha, J&K, HP, Ladakh, all NE states, A&N
// Zone D : Extended NCR fringe — Faridabad, Gautam Buddha Nagar (excl Noida),
//          Bulandshahr, Alwar, Bagpat, Bharatpur, Jhajjar, Jind, Nuh, Panipat, Rewari

export type ZoneType = "A" | "B" | "C" | "D";

// ---------------------------------------------------------------------------
// City → Zone lookup
// For any city not listed here, call getZoneForState() as a fallback.
// ---------------------------------------------------------------------------
export const CITY_ZONE_MAP: Record<string, ZoneType> = {

    // ── ZONE A ────────────────────────────────────────────────────────────────

    // Delhi / NCR core
    "Delhi": "A",
    "New Delhi": "A",
    "Ghaziabad": "A",
    "Noida": "A",
    "Greater Noida": "A",
    "Gurgaon": "A",
    "Gurugram": "A",
    "Hapur": "A",
    "Meerut": "A",

    // Mumbai region
    "Mumbai": "A",
    "Navi Mumbai": "A",
    "Thane": "A",
    "Kalyan": "A",
    "Dombivali": "A",

    // Gujarat — only these two cities are Zone A
    "Ahmedabad": "A",
    "Surat": "A",

    // Haryana (entire state = A, except the Zone D towns listed below)
    "Ambala": "A",
    "Hisar": "A",
    "Rohtak": "A",
    "Karnal": "A",
    "Sonipat": "A",
    "Yamunanagar": "A",
    "Kurukshetra": "A",
    "Sirsa": "A",
    "Bhiwani": "A",
    "Panchkula": "A",
    "Palwal": "A",
    "Faridabad": "A",   // Haryana city; "Faridabad district" NCR fringe = D, but city proper = A

    // Union Territories — Daman & Diu, Dadra & Nagar Haveli
    "Daman": "A",
    "Diu": "A",
    "Silvassa": "A",

    // ── ZONE B ────────────────────────────────────────────────────────────────

    // Explicitly Zone B metros
    "Bangalore": "B",
    "Bengaluru": "B",
    "Hyderabad": "B",
    "Secunderabad": "B",
    "Chennai": "B",
    "Kolkata": "B",
    "Pune": "B",

    // Telangana (entire state = B)
    "Warangal": "B",
    "Nizamabad": "B",
    "Karimnagar": "B",
    "Khammam": "B",
    "Mahbubnagar": "B",
    "Nalgonda": "B",
    "Adilabad": "B",

    // Andhra Pradesh (entire state = B)
    "Visakhapatnam": "B",
    "Vizag": "B",
    "Vijayawada": "B",
    "Tirupati": "B",
    "Nellore": "B",
    "Guntur": "B",
    "Rajahmundry": "B",
    "Kakinada": "B",
    "Kurnool": "B",
    "Anantapur": "B",
    "Kadapa": "B",
    "Eluru": "B",
    "Ongole": "B",

    // Madhya Pradesh (entire state = B)
    "Indore": "B",
    "Bhopal": "B",
    "Jabalpur": "B",
    "Gwalior": "B",
    "Ujjain": "B",
    "Sagar": "B",
    "Katni": "B",
    "Rewa": "B",
    "Satna": "B",
    "Chhindwara": "B",
    "Dewas": "B",
    "Khandwa": "B",
    "Ratlam": "B",

    // Gujarat (all except Ahmedabad & Surat = B)
    "Vadodara": "B",
    "Baroda": "B",
    "Rajkot": "B",
    "Bhavnagar": "B",
    "Jamnagar": "B",
    "Junagadh": "B",
    "Ankleshwar": "B",
    "Nadiad": "B",
    "Morbi": "B",
    "Gandhidham": "B",
    "Mehsana": "B",
    "Bharuch": "B",
    "Navsari": "B",
    "Valsad": "B",
    "Vapi": "B",
    "Anand": "B",
    "Surendranagar": "B",
    "Porbandar": "B",
    "Godhra": "B",
    "Gandhinagar": "B",
    "Amreli": "B",
    "Palanpur": "B",

    // Goa (entire state = B)
    "Goa": "B",
    "Panaji": "B",
    "Margao": "B",
    "Vasco da Gama": "B",
    "Mapusa": "B",

    // Uttarakhand (entire state = B)
    "Dehradun": "B",
    "Haldwani": "B",
    "Roorkee": "B",
    "Nainital": "B",
    "Mussoorie": "B",
    "Haridwar": "B",
    "Rishikesh": "B",
    "Rudrapur": "B",
    "Kashipur": "B",
    "Kotdwar": "B",

    // Chhattisgarh (entire state = B)
    "Raipur": "B",
    "Bilaspur": "B",
    "Bhilai": "B",
    "Durg": "B",
    "Korba": "B",
    "Rajnandgaon": "B",
    "Jagdalpur": "B",
    "Ambikapur": "B",

    // Pondicherry (= B)
    "Pondicherry": "B",
    "Puducherry": "B",

    // ── ZONE C ────────────────────────────────────────────────────────────────

    // Rajasthan
    "Jaipur": "C",
    "Jodhpur": "C",
    "Udaipur": "C",
    "Bikaner": "C",
    "Kota": "C",
    "Ajmer": "C",
    "Jhunjhunu": "C",
    "Sikar": "C",
    "Pali": "C",
    "Barmer": "C",
    "Alwar": "C",     // Rajasthan city; the Zone D "Alwar" is the NCR-fringe district
    "Bharatpur": "C", // Rajasthan city proper (Zone D entry refers to NCR-adjacent district)
    "Chittorgarh": "C",
    "Nagaur": "C",
    "Sri Ganganagar": "C",

    // Uttar Pradesh (rest — excl NCR cities already in A)
    "Lucknow": "C",
    "Kanpur": "C",
    "Agra": "C",
    "Varanasi": "C",
    "Allahabad": "C",
    "Prayagraj": "C",
    "Bareilly": "C",
    "Aligarh": "C",
    "Gorakhpur": "C",
    "Moradabad": "C",
    "Saharanpur": "C",
    "Etawah": "C",
    "Ghazipur": "C",
    "Muzaffarnagar": "C",
    "Mathura": "C",
    "Firozabad": "C",
    "Jhansi": "C",
    "Ayodhya": "C",
    "Faizabad": "C",
    "Sultanpur": "C",
    "Azamgarh": "C",
    "Mirzapur": "C",
    "Shahjahanpur": "C",
    "Rampur": "C",
    "Bulandshahr": "C", // UP city; Zone D entry is NCR district fringe

    // Punjab & Chandigarh
    "Chandigarh": "C",
    "Ludhiana": "C",
    "Jalandhar": "C",
    "Amritsar": "C",
    "Mohali": "C",
    "Pathankot": "C",
    "Gurdaspur": "C",
    "Bathinda": "C",
    "Patiala": "C",
    "Hoshiarpur": "C",
    "Firozpur": "C",
    "Kapurthala": "C",
    "Sangrur": "C",

    // Himachal Pradesh
    "Shimla": "C",
    "Manali": "C",
    "Mandi": "C",
    "Kangra": "C",
    "Dharamshala": "C",
    "Solan": "C",
    "Kullu": "C",
    "Baddi": "C",

    // J&K
    "Srinagar": "C",
    "Jammu": "C",
    "Sopore": "C",
    "Baramulla": "C",
    "Anantnag": "C",

    // Ladakh
    "Leh": "C",
    "Kargil": "C",

    // Bihar
    "Patna": "C",
    "Gaya": "C",
    "Bhagalpur": "C",
    "Madhubani": "C",
    "Hajipur": "C",
    "Muzaffarpur": "C",
    "Darbhanga": "C",
    "Purnia": "C",
    "Arrah": "C",
    "Begusarai": "C",
    "Sitamarhi": "C",

    // Jharkhand
    "Ranchi": "C",
    "Dhanbad": "C",
    "Bokaro": "C",
    "Jamshedpur": "C",
    "Giridih": "C",
    "Hazaribagh": "C",
    "Deoghar": "C",
    "Dumka": "C",

    // West Bengal (rest — excl Kolkata)
    "Howrah": "C",
    "Durgapur": "C",
    "Siliguri": "C",
    "Asansol": "C",
    "Darjeeling": "C",
    "Srirampur": "C",
    "Kharagpur": "C",
    "Bardhaman": "C",
    "Malda": "C",
    "Cooch Behar": "C",
    "Haldia": "C",

    // Maharashtra (rest — excl Mumbai & Pune)
    "Nagpur": "C",
    "Nasik": "C",
    "Nashik": "C",
    "Aurangabad": "C",
    "Chhatrapati Sambhajinagar": "C",
    "Kolhapur": "C",
    "Solapur": "C",
    "Sangli": "C",
    "Jalgaon": "C",
    "Ahmednagar": "C",
    "Akola": "C",
    "Latur": "C",
    "Nanded": "C",
    "Amravati": "C",
    "Satara": "C",
    "Ratnagiri": "C",
    "Chandrapur": "C",
    "Yavatmal": "C",

    // Karnataka (rest — excl Bengaluru)
    "Mysuru": "C",
    "Mysore": "C",
    "Mangalore": "C",
    "Mangaluru": "C",
    "Hubballi": "C",
    "Hubli": "C",
    "Belgaum": "C",
    "Belagavi": "C",
    "Davangere": "C",
    "Davanagere": "C",
    "Bellary": "C",
    "Ballari": "C",
    "Tumkur": "C",
    "Tumakuru": "C",
    "Hassan": "C",
    "Mandya": "C",
    "Shimoga": "C",
    "Shivamogga": "C",
    "Udupi": "C",
    "Bidar": "C",
    "Raichur": "C",
    "Gulbarga": "C",
    "Kalaburagi": "C",
    "Bagalkot": "C",

    // Tamil Nadu (excl Chennai & Pondicherry)
    "Coimbatore": "C",
    "Madurai": "C",
    "Trichy": "C",
    "Tiruchirappalli": "C",
    "Tiruppur": "C",
    "Vellore": "C",
    "Nagercoil": "C",
    "Salem": "C",
    "Erode": "C",
    "Thanjavur": "C",
    "Dindigul": "C",
    "Thoothukudi": "C",
    "Tirunelveli": "C",
    "Kanchipuram": "C",
    "Cuddalore": "C",

    // Kerala
    "Kochi": "C",
    "Cochin": "C",
    "Thiruvananthapuram": "C",
    "Trivandrum": "C",
    "Kottayam": "C",
    "Alappuzha": "C",
    "Thrissur": "C",
    "Kannur": "C",
    "Kasaragod": "C",
    "Kozhikode": "C",
    "Calicut": "C",
    "Palakkad": "C",
    "Malappuram": "C",
    "Kollam": "C",
    "Pathanamthitta": "C",
    "Idukki": "C",

    // Odisha
    "Bhubaneswar": "C",
    "Cuttack": "C",
    "Rourkela": "C",
    "Balasore": "C",
    "Berhampur": "C",
    "Sambalpur": "C",
    "Puri": "C",

    // North East
    "Guwahati": "C",
    "Dibrugarh": "C",
    "Jorhat": "C",
    "Silchar": "C",
    "Shillong": "C",
    "Imphal": "C",
    "Gangtok": "C",
    "Itanagar": "C",
    "Aizawl": "C",
    "Agartala": "C",
    "Kohima": "C",
    "Dimapur": "C",
    "Tezpur": "C",
    "Nagaon": "C",

    // Andaman & Nicobar, Lakshadweep
    "Andaman": "C",
    "Port Blair": "C",
    "Lakshadweep": "C",

    // ── ZONE D ────────────────────────────────────────────────────────────────
    // NCR-fringe districts explicitly excluded from Zone A per ICICI Lombard

    "Gautam Buddha Nagar": "D", // district (excl Noida city which is Zone A)
    "Bulandshahr": "D",         // NCR-adjacent district
    "Jhajjar": "D",
    "Jind": "D",
    "Nuh": "D",
    "Mewat": "D",
    "Panipat": "D",
    "Rewari": "D",
    "Bagpat": "D",
};

// ---------------------------------------------------------------------------
// Fallback: derive zone from state name when city is not in the map above
// ---------------------------------------------------------------------------
export const STATE_ZONE_MAP: Record<string, ZoneType> = {
    // Zone A states/UTs
    "Haryana": "A",
    "Delhi": "A",
    "Daman and Diu": "A",
    "Dadra and Nagar Haveli": "A",
    "Dadra and Nagar Haveli and Daman and Diu": "A",

    // Zone B states/UTs
    "Telangana": "B",
    "Andhra Pradesh": "B",
    "Madhya Pradesh": "B",
    "Goa": "B",
    "Gujarat": "B",
    "Uttarakhand": "B",
    "Chhattisgarh": "B",
    "Pondicherry": "B",
    "Puducherry": "B",

    // Zone C — Rest of India
    "Rajasthan": "C",
    "Uttar Pradesh": "C",
    "Punjab": "C",
    "Chandigarh": "C",
    "Bihar": "C",
    "Jharkhand": "C",
    "West Bengal": "C",
    "Maharashtra": "C",
    "Karnataka": "C",
    "Tamil Nadu": "C",
    "Kerala": "C",
    "Odisha": "C",
    "Jammu and Kashmir": "C",
    "Himachal Pradesh": "C",
    "Ladakh": "C",
    "Assam": "C",
    "Meghalaya": "C",
    "Manipur": "C",
    "Sikkim": "C",
    "Arunachal Pradesh": "C",
    "Mizoram": "C",
    "Tripura": "C",
    "Nagaland": "C",
    "Andaman and Nicobar Islands": "C",
    "Lakshadweep": "C",
};

// ---------------------------------------------------------------------------
// Primary lookup: city → zone
// Falls back to state-level zone if city is unknown.
// If both are unknown, defaults to "C" (Rest of India — safest assumption).
// ---------------------------------------------------------------------------
export function getZoneForCity(city: string): ZoneType | undefined {
    if (CITY_ZONE_MAP[city]) return CITY_ZONE_MAP[city];

    const normalized = Object.keys(CITY_ZONE_MAP).find(
        (k) => k.toLowerCase() === city.toLowerCase()
    );
    return normalized ? CITY_ZONE_MAP[normalized] : undefined;
}

export function getZoneForState(state: string): ZoneType {
    if (STATE_ZONE_MAP[state]) return STATE_ZONE_MAP[state];

    const normalized = Object.keys(STATE_ZONE_MAP).find(
        (k) => k.toLowerCase() === state.toLowerCase()
    );
    return normalized ? STATE_ZONE_MAP[normalized] : "C";
}

// Usage:
//   const zone = getZoneForCity(city) ?? getZoneForState(state) ?? "C";
