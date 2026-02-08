import { getAllStates, getCitiesForState } from "./indian-cities-data";

// --- Reverse Lookup (City -> Pincode) ---
export const CITY_TO_PINCODE: Record<string, string> = {
  "Mumbai": "400001",
  "Delhi": "110001",
  "New Delhi": "110001",
  "Bangalore": "560001",
  "Bengaluru": "560001",
  "Chennai": "600001",
  "Kolkata": "700001",
  "Hyderabad": "500001",
  "Pune": "411001",
  "Ahmedabad": "380001",
  "Jaipur": "302001",
  "Surat": "395001",
  "Lucknow": "226001",
  "Kanpur": "208001",
  "Nagpur": "440001",
  "Indore": "452001",
  "Thane": "400601",
  "Bhopal": "462001",
  "Visakhapatnam": "530001",
  "Patna": "800001",
  "Vadodara": "390001",
  "Ghaziabad": "201001",
  "Ludhiana": "141001",
  "Agra": "282001",
  "Nashik": "422001",
  "Ranchi": "834001",
  "Faridabad": "121001",
  "Meerut": "250001",
  "Rajkot": "360001",
  "Varanasi": "221001",
  "Srinagar": "190001",
  "Aurangabad": "431001",
  "Dhanbad": "826001",
  "Amritsar": "143001",
  "Allahabad": "211001",
  "Coimbatore": "641001",
  "Chandigarh": "160017",
  "Guwahati": "781001",
  "Gurgaon": "122001", 
  "Gurugram": "122001",
  "Noida": "201301"
};

// --- Forward Lookup Mappings ---

// 1. Exact Pincode -> City (High Confidence)
const PINCODE_CITY_EXACT: Record<string, string> = {
  "400001": "Mumbai",
  "110001": "Delhi",
  "560001": "Bangalore",
  "600001": "Chennai",
  "700001": "Kolkata",
  "122001": "Gurgaon",
  "201301": "Noida",
  "411001": "Pune",
  "500081": "Hyderabad",
  "160017": "Chandigarh"
};

// 2. Prefix (3-digit) -> City (Medium Confidence)
// Maps the first 3 digits of a pincode to a major city
const PINCODE_CITY_PREFIX: Record<string, { city: string, state: string }> = {
  "110": { city: "Delhi", state: "Delhi" },
  "400": { city: "Mumbai", state: "Maharashtra" },
  "401": { city: "Thane", state: "Maharashtra" }, // Approx
  "560": { city: "Bangalore", state: "Karnataka" },
  "600": { city: "Chennai", state: "Tamil Nadu" },
  "700": { city: "Kolkata", state: "West Bengal" },
  "500": { city: "Hyderabad", state: "Telangana" },
  "411": { city: "Pune", state: "Maharashtra" },
  "380": { city: "Ahmedabad", state: "Gujarat" },
  "302": { city: "Jaipur", state: "Rajasthan" },
  "226": { city: "Lucknow", state: "Uttar Pradesh" },
  "122": { city: "Gurgaon", state: "Haryana" },
  "201": { city: "Noida", state: "Uttar Pradesh" },
  "160": { city: "Chandigarh", state: "Chandigarh" },
  "440": { city: "Nagpur", state: "Maharashtra" },
  "452": { city: "Indore", state: "Madhya Pradesh" },
  "395": { city: "Surat", state: "Gujarat" },
  "208": { city: "Kanpur", state: "Uttar Pradesh" }
};

// 3. Prefix (2-digit) -> State (Low Confidence)
const PINCODE_PREFIX_STATE: Record<string, string> = {
  "11": "Delhi",
  "12": "Haryana", 
  "13": "Haryana",
  "14": "Punjab", "15": "Punjab",
  "16": "Chandigarh",
  "17": "Himachal Pradesh",
  "18": "Jammu & Kashmir", "19": "Jammu & Kashmir",
  "20": "Uttar Pradesh", "21": "Uttar Pradesh", "22": "Uttar Pradesh", "23": "Uttar Pradesh", "24": "Uttar Pradesh", "25": "Uttar Pradesh", "26": "Uttar Pradesh", "27": "Uttar Pradesh", "28": "Uttar Pradesh",
  "30": "Rajasthan", "31": "Rajasthan", "32": "Rajasthan", "33": "Rajasthan", "34": "Rajasthan",
  "36": "Gujarat", "37": "Gujarat", "38": "Gujarat", "39": "Gujarat",
  "40": "Maharashtra", "41": "Maharashtra", "42": "Maharashtra", "43": "Maharashtra", "44": "Maharashtra",
  "45": "Madhya Pradesh", "46": "Madhya Pradesh", "47": "Madhya Pradesh", "48": "Madhya Pradesh",
  "49": "Chhattisgarh",
  "50": "Telangana",
  "51": "Andhra Pradesh", "52": "Andhra Pradesh", "53": "Andhra Pradesh",
  "56": "Karnataka", "57": "Karnataka", "58": "Karnataka", "59": "Karnataka",
  "60": "Tamil Nadu", "61": "Tamil Nadu", "62": "Tamil Nadu", "63": "Tamil Nadu", "64": "Tamil Nadu", "65": "Tamil Nadu", "66": "Tamil Nadu",
  "67": "Kerala", "68": "Kerala", "69": "Kerala",
  "70": "West Bengal", "71": "West Bengal", "72": "West Bengal", "73": "West Bengal", "74": "West Bengal",
  "75": "Orissa", "76": "Orissa", "77": "Orissa",
  "78": "Assam",
  "79": "Manipur",
  "80": "Bihar", "81": "Bihar", "82": "Bihar", "83": "Jharkhand", "84": "Bihar", "85": "Bihar",
  "90": "Chhattisgarh"
};

export interface LocationResult {
  state: string;
  city: string;
  isExact: boolean;
}

export function lookupPincode(pincode: string): LocationResult | null {
  if (!pincode || pincode.length < 2) return null;

  // 1. Exact City Match
  if (PINCODE_CITY_EXACT[pincode]) {
     const city = PINCODE_CITY_EXACT[pincode];
     const prefix3 = pincode.substring(0, 3);
     const prefix2 = pincode.substring(0, 2);
     
     // Resolve State
     let state = "";
     if (PINCODE_CITY_PREFIX[prefix3]) state = PINCODE_CITY_PREFIX[prefix3].state;
     else if (PINCODE_PREFIX_STATE[prefix2]) state = PINCODE_PREFIX_STATE[prefix2];
     
     return { state, city, isExact: true };
  }

  // 2. 3-Digit Prefix Match (City Level)
  if (pincode.length >= 3) {
      const prefix3 = pincode.substring(0, 3);
      const match = PINCODE_CITY_PREFIX[prefix3];
      if (match) {
          return { state: match.state, city: match.city, isExact: false }; 
      }
  }

  // 3. 2-Digit Prefix Match (State Level)
  const prefix2 = pincode.substring(0, 2);
  const state = PINCODE_PREFIX_STATE[prefix2];

  if (state) {
    return { state, city: "", isExact: false };
  }

  return null;
}

export function getGenericPincode(city: string): string | null {
  return CITY_TO_PINCODE[city] || null;
}
