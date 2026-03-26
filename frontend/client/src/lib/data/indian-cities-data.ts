/**
 * Indian States and Cities Data — self-contained, no external import needed
 */

export interface StateCityData {
  state: string;
  cities: string[];
}

const RAW_DATA: Record<string, string> = {
  "Andhra Pradesh": "Visakhapatnam|Vijayawada|Guntur|Nellore|Kurnool|Rajahmundry|Tirupati|Kakinada|Kadapa|Anantapur|Vizianagaram|Eluru|Ongole|Nandyal|Machilipatnam|Adoni|Tenali|Chittoor|Hindupur|Proddatur|Bhimavaram|Madanapalle|Guntakal|Dharmavaram|Gudivada|Narasaraopet|Tadipatri|Tadepalligudem|Chilakaluripet|Yemmiganur",
  "Arunachal Pradesh": "Itanagar|Naharlagun|Pasighat|Namsai|Bomdila|Ziro|Along|Tezu|Khonsa|Aalo|Roing|Daporijo|Tawang|Changlang|Seppa",
  "Assam": "Guwahati|Silchar|Dibrugarh|Jorhat|Nagaon|Tinsukia|Tezpur|Bongaigaon|Dhubri|Karimganj|Sibsagar|Goalpara|Barpeta|Mangaldoi|North Lakhimpur|Diphu|Haflong|Golaghat|Morigaon|Hailakandi",
  "Bihar": "Patna|Gaya|Bhagalpur|Muzaffarpur|Purnia|Darbhanga|Bihar Sharif|Arrah|Begusarai|Katihar|Munger|Chhapra|Danapur|Bettiah|Saharsa|Sasaram|Hajipur|Dehri|Siwan|Motihari|Nawada|Bagaha|Buxar|Kishanganj|Sitamarhi|Jamalpur|Jehanabad|Aurangabad|Lakhisarai|Sheikhpura",
  "Chhattisgarh": "Raipur|Bhilai|Korba|Bilaspur|Durg|Rajnandgaon|Jagdalpur|Raigarh|Ambikapur|Mahasamund|Dhamtari|Chirmiri|Bhatapara|Naila Janjgir|Tilda Newra|Mungeli|Manendragarh|Sakti|Dongargarh|Kanker",
  "Goa": "Panaji|Vasco da Gama|Margao|Mapusa|Ponda|Bicholim|Curchorem|Sanquelim|Cuncolim|Valpoi|Calangute|Candolim|Anjuna|Colva|Mormugao",
  "Gujarat": "Ahmedabad|Surat|Vadodara|Rajkot|Bhavnagar|Jamnagar|Junagadh|Gandhinagar|Anand|Navsari|Morbi|Nadiad|Surendranagar|Bharuch|Mehsana|Bhuj|Porbandar|Palanpur|Valsad|Vapi|Ankleshwar|Gondal|Veraval|Godhra|Patan|Kalol|Dahod|Botad|Amreli|Deesa",
  "Haryana": "Faridabad|Gurgaon|Panipat|Ambala|Yamunanagar|Rohtak|Hisar|Karnal|Sonipat|Panchkula|Bhiwani|Sirsa|Bahadurgarh|Jind|Thanesar|Kaithal|Palwal|Rewari|Hansi|Narnaul|Fatehabad|Gohana|Tohana|Narwana|Mewat|Charkhi Dadri|Shahabad|Pehowa|Samalkha|Pinjore",
  "Himachal Pradesh": "Shimla|Mandi|Solan|Dharamshala|Palampur|Baddi|Nahan|Paonta Sahib|Sundarnagar|Chamba|Una|Kullu|Hamirpur|Bilaspur|Kangra|Nurpur|Rohru|Rampur|Sirmaur|Keylong",
  "Jharkhand": "Ranchi|Jamshedpur|Dhanbad|Bokaro|Deoghar|Phusro|Hazaribagh|Giridih|Ramgarh|Medininagar|Chirkunda|Chaibasa|Daltonganj|Sahibganj|Dumka|Jugsalai|Gumla|Lohardaga|Simdega|Jamtara",
  "Karnataka": "Bangalore|Mysore|Hubli|Mangalore|Belgaum|Davangere|Bellary|Shimoga|Tumkur|Bijapur|Raichur|Bidar|Gulbarga|Udupi|Hassan|Dharwad|Hospet|Gadag|Bagalkot|Chitradurga|Kolar|Mandya|Chikmagalur|Haveri|Vijayapura|Yadgir|Koppal|Karwar|Gangavati|Robertsonpet",
  "Kerala": "Thiruvananthapuram|Kochi|Kozhikode|Thrissur|Kollam|Palakkad|Alappuzha|Kannur|Kottayam|Malappuram|Kasaragod|Pathanamthitta|Idukki|Wayanad|Ernakulam|Manjeri|Thalassery|Ponnani|Vatakara|Kanhangad",
  "Madhya Pradesh": "Indore|Bhopal|Jabalpur|Gwalior|Ujjain|Sagar|Dewas|Satna|Ratlam|Rewa|Murwara|Singrauli|Burhanpur|Khandwa|Bhind|Chhindwara|Guna|Shivpuri|Vidisha|Chhatarpur|Damoh|Mandsaur|Khargone|Neemuch|Pithampur|Hoshangabad|Itarsi|Sehore|Seoni|Datia",
  "Maharashtra": "Mumbai|Pune|Nagpur|Thane|Nashik|Aurangabad|Solapur|Amravati|Kolhapur|Navi Mumbai|Akola|Latur|Dhule|Ahmednagar|Chandrapur|Parbhani|Jalgaon|Bhiwandi|Nanded|Sangli|Malegaon|Jalna|Ulhasnagar|Satara|Ratnagiri|Osmanabad|Beed|Wardha|Yavatmal|Gondia",
  "Manipur": "Imphal|Thoubal|Bishnupur|Churachandpur|Senapati|Ukhrul|Chandel|Tamenglong|Jiribam|Kakching|Moreh|Wangjing|Lilong|Nambol|Moirang",
  "Meghalaya": "Shillong|Tura|Jowai|Nongstoin|Williamnagar|Baghmara|Resubelpara|Nongpoh|Mairang|Cherrapunji|Mawkyrwat|Ampati",
  "Mizoram": "Aizawl|Lunglei|Saiha|Champhai|Kolasib|Serchhip|Mamit|Lawngtlai|Khawzawl|Saitual",
  "Nagaland": "Kohima|Dimapur|Mokokchung|Tuensang|Wokha|Zunheboto|Phek|Mon|Longleng|Kiphire|Peren|Noklak",
  "Odisha": "Bhubaneswar|Cuttack|Rourkela|Brahmapur|Sambalpur|Puri|Balasore|Bhadrak|Baripada|Jharsuguda|Bargarh|Jeypore|Rayagada|Balangir|Dhenkanal|Keonjhar|Koraput|Phulbani|Paradip|Sundargarh",
  "Punjab": "Ludhiana|Amritsar|Jalandhar|Patiala|Bathinda|Mohali|Hoshiarpur|Batala|Pathankot|Moga|Abohar|Malerkotla|Khanna|Phagwara|Muktsar|Barnala|Rajpura|Firozpur|Kapurthala|Sangrur",
  "Rajasthan": "Jaipur|Jodhpur|Kota|Bikaner|Ajmer|Udaipur|Bhilwara|Alwar|Bharatpur|Sikar|Pali|Sri Ganganagar|Tonk|Kishangarh|Beawar|Hanumangarh|Dhaulpur|Gangapur City|Sawai Madhopur|Jhunjhunu|Churu|Nagaur|Baran|Jhalawar|Barmer|Banswara|Dausa|Bundi|Rajsamand|Jalore",
  "Sikkim": "Gangtok|Namchi|Mangan|Geyzing|Jorethang|Nayabazar|Rangpo|Singtam|Yuksom|Pelling",
  "Tamil Nadu": "Chennai|Coimbatore|Madurai|Tiruchirappalli|Salem|Tirunelveli|Tiruppur|Ranipet|Nagercoil|Thanjavur|Vellore|Kancheepuram|Erode|Tiruvannamalai|Pollachi|Rajapalayam|Sivakasi|Pudukkottai|Neyveli|Nagapattinam|Viluppuram|Karur|Cuddalore|Kumbakonam|Hosur|Dindigul|Theni|Ooty|Kodaikanal|Thoothukudi",
  "Telangana": "Hyderabad|Warangal|Nizamabad|Khammam|Karimnagar|Ramagundam|Mahbubnagar|Nalgonda|Adilabad|Suryapet|Miryalaguda|Jagtial|Siddipet|Mancherial|Bodhan|Bhongir|Vikarabad|Kamareddy|Wanaparthy|Sangareddy",
  "Tripura": "Agartala|Dharmanagar|Udaipur|Kailasahar|Belonia|Khowai|Ambassa|Kumarghat|Sonamura|Sabroom",
  "Uttar Pradesh": "Lucknow|Kanpur|Ghaziabad|Agra|Varanasi|Meerut|Allahabad|Bareilly|Aligarh|Moradabad|Saharanpur|Gorakhpur|Noida|Firozabad|Jhansi|Muzaffarnagar|Mathura|Shahjahanpur|Rampur|Hapur|Etawah|Faizabad|Mau|Bulandshahr|Sambhal|Amroha|Hardoi|Fatehpur|Raebareli|Orai",
  "Uttarakhand": "Dehradun|Haridwar|Roorkee|Haldwani|Rudrapur|Kashipur|Rishikesh|Kotdwar|Ramnagar|Pithoragarh|Tehri|Uttarkashi|Chamoli|Mussoorie|Nainital|Almora|Bageshwar|Champawat|Rudraprayag|Lansdowne",
  "West Bengal": "Kolkata|Asansol|Siliguri|Durgapur|Bardhaman|Malda|Baharampur|Habra|Kharagpur|Shantipur|Dankuni|Dhulian|Ranaghat|Haldia|Raiganj|Krishnanagar|Nabadwip|Medinipur|Jalpaiguri|Balurghat",
  "Andaman and Nicobar Islands": "Port Blair|Diglipur|Rangat|Mayabunder|Car Nicobar|Hut Bay|Neil Island|Havelock Island",
  "Chandigarh": "Chandigarh|Manimajra|Burail|Dadu Majra|Mauli Jagran",
  "Dadra and Nagar Haveli and Daman and Diu": "Daman|Diu|Silvassa|Amli|Khanvel",
  "Delhi": "New Delhi|Delhi|Dwarka|Rohini|Pitampura|Janakpuri|Laxmi Nagar|Shahdara|Narela|Bawana|Najafgarh|Mehrauli|Saket|Vasant Kunj|Karol Bagh",
  "Jammu and Kashmir": "Srinagar|Jammu|Anantnag|Sopore|Baramulla|Kathua|Udhampur|Punch|Rajouri|Leh|Kargil|Kupwara|Pulwama|Shopian|Bandipora",
  "Ladakh": "Leh|Kargil|Diskit|Padum|Nyoma|Durbuk",
  "Lakshadweep": "Kavaratti|Agatti|Amini|Andrott|Minicoy",
  "Puducherry": "Puducherry|Karaikal|Mahe|Yanam|Ozhukarai|Villianur|Ariyankuppam",
};

function parseCities(cityString: string): string[] {
  if (!cityString || cityString.trim() === "") return [];
  return cityString
    .split("|")
    .map((city) => city.trim())
    .filter((city) => city.length > 0);
}

export const INDIAN_STATES_CITIES: StateCityData[] = Object.entries(RAW_DATA).map(
  ([state, citiesString]) => ({
    state,
    cities: parseCities(citiesString),
  })
);

export function getCitiesForState(stateName: string): string[] {
  const stateData = INDIAN_STATES_CITIES.find(
    (sc) => sc.state.toLowerCase() === stateName.toLowerCase()
  );
  return stateData?.cities || [];
}

export function getAllStates(): string[] {
  return Object.keys(RAW_DATA);
}

export function getAllCities(): string[] {
  const allCities: string[] = [];
  INDIAN_STATES_CITIES.forEach(({ cities }) => {
    allCities.push(...cities);
  });
return Array.from(new Set(allCities)).sort();
}

export function getStateByCity(cityName: string): string | null {
  const stateData = INDIAN_STATES_CITIES.find(({ cities }) =>
    cities.some((city) => city.toLowerCase() === cityName.toLowerCase())
  );
  return stateData?.state || null;
}
