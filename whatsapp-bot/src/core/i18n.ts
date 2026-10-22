/**
 * Replies in the advisor's language: English, Hinglish (Roman) or Hindi (Devanagari).
 *
 * The bot writes every reply in English; `localise` then swaps each LINE it recognises for
 * its Hinglish or Hindi version. A line it does not recognise stays English, so nothing is
 * ever lost or garbled. Only the fixed wording is translated: names, amounts, dates, plan
 * names, links, commands (YES, SHARE, RENEWALS) and anything the engine or a policy says stay
 * exactly as they are, the same rule the portal's Hindi mode follows. Customer messages the
 * advisor forwards are never touched (their language is chosen separately).
 *
 * Also: which language the advisor is writing in (detectLang), and the rules that let the
 * bot understand common Hindi and Hinglish phrasings without the model.
 */

export type ReplyLang = "english" | "hinglish" | "hindi";

/* ── Which language is the advisor writing in? ───────────────────────── */

const DEVANAGARI = /[ऀ-ॿ]/g;
/** Words that only appear in Roman Hindi (not in English). */
const HINGLISH_WORDS = new Set([
  "hai", "hain", "kya", "kaun", "kaunsa", "kisko", "kise", "kiska", "kiski", "kiske", "kitna", "kitne", "kitni",
  "karo", "karna", "karni", "karu", "karun", "kardo", "kar", "karke", "kijiye", "dijiye", "batao", "bataiye", "bhejo", "bhej",
  "chahiye", "aaj", "kal", "parso", "mujhe", "mera", "mere", "meri", "aap", "aapka", "aapke", "unka", "unki", "uska", "uski",
  "nahi", "nahin", "haan", "wala", "wali", "abhi", "hua", "hui", "gaya", "gayi", "liya", "raha", "rahi", "tha", "thi",
  "bhai", "ji", "yaar", "dekho", "dikhao", "bolo", "hoga", "kaise", "kab", "kahan", "kyun", "aur", "bhi", "toh", "ne", "ko",
  "ka", "ki", "ke", "mein", "sab", "sabhi", "wapas", "mana", "baat", "batana", "jodo", "naya", "nayi", "dobara",
  "le", "li", "lena", "diya", "kiya", "gaye", "hogi", "lega", "legi", "janmdin", "badhai", "bhejiye", "chahte",
  "sabke", "sabka", "sabko", "sabhi", "sabse", "inke", "unke", "daal", "rakho", "lagao", "kal", "karwa",
  "hogayi", "hogaya", "hogai", "kardo", "kardiya", "bhai", "accha", "theek",
]);
/** Everyday English function words: two of these and no Hinglish words is English. */
const ENGLISH_WORDS = new Set([
  "the", "is", "are", "was", "my", "me", "to", "for", "what", "who", "how", "please", "can", "you", "show", "send",
  "i", "of", "a", "an", "and", "with", "do", "does", "should", "will", "would", "when", "where", "which", "this", "that",
  "his", "her", "their", "him", "them", "has", "have", "about", "tell", "give", "need", "want",
]);

/** The language a message is clearly written in, or null when it could be any (a command, a
 *  name, a number). Null keeps whatever the advisor used last. */
export function detectLang(text: string): ReplyLang | null {
  const t = text.trim();
  const dev = (t.match(DEVANAGARI) || []).length;
  const latin = (t.match(/[a-z]/gi) || []).length;
  if (dev >= 2 && dev >= latin) return "hindi";
  const words = t.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const hing = new Set(words.filter((w) => HINGLISH_WORDS.has(w))).size;
  const eng = new Set(words.filter((w) => ENGLISH_WORDS.has(w))).size;
  if (hing >= 2 && hing >= eng) return "hinglish";
  if (eng >= 2 && hing === 0) return "english";
  return null;
}

/** HINDI / HINGLISH / ENGLISH (and "hindi mein baat karo", "हिंदी में") set the reply language. */
export function langCommand(text: string): ReplyLang | null {
  const t = text.trim().toLowerCase().replace(/[.!?।]+$/, "");
  if (/^((reply |talk |speak )?(in )?hindi|hindi (mein|me|please|mode)( (baat|jawab) karo)?|हिंदी( में)?( बात करो| जवाब दो)?)$/.test(t)) return "hindi";
  if (/^((reply |talk )?(in )?hinglish|hinglish (mein|me|please|mode)( (baat|jawab) karo)?)$/.test(t)) return "hinglish";
  if (/^((reply |talk |speak )?(in )?english|english (mein|me|please|mode)( (baat|jawab) karo)?|अंग्रेज़ी( में)?|इंग्लिश( में)?)$/.test(t)) return "english";
  return null;
}

export const LANG_SET: Record<ReplyLang, string> = {
  english: "Okay, I'll reply in English. Send HINDI or HINGLISH any time to switch.",
  hinglish: "Theek hai, ab jawab Hinglish mein aayenge. Naam, plan aur policy ki details English mein hi rahengi. ENGLISH likhiye to wapas English.",
  hindi: "ठीक है, अब जवाब हिंदी में आएँगे। नाम, प्लान और पॉलिसी की जानकारी अंग्रेज़ी में ही रहेगी। वापस अंग्रेज़ी के लिए ENGLISH लिखिए।",
};

/* ── Devanagari names to English letters (to find "रमेश" as Ramesh) ───── */

// Long vowels are written "A" while converting so the silent final "a" of a consonant can be
// told apart from a written "aa" (नेहा is Neha, not Neh); they become "a" at the end.
const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "A", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};
const MATRAS: Record<string, string> = {
  "ा": "A", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};
const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "d", "ढ़": "dh", "फ़": "f",
};

/** "रमेश कुमार" -> "Ramesh Kumar", "नेहा" -> "Neha". Good enough to FIND a name (every change
 *  is confirmed with the name as saved, before anything is written); not a general
 *  transliterator. */
export function devanagariToLatin(text: string): string {
  const chars = [...text.normalize("NFC")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    let c = chars[i];
    if (chars[i + 1] === "\u093C") { c += "\u093C"; i++; } // nukta: ज़, फ़
    const next = chars[i + 1];
    if (CONSONANTS[c]) {
      out += CONSONANTS[c];
      if (next && MATRAS[next]) { out += MATRAS[next]; i++; }
      else if (next === "्") i++;
      else out += "a"; // inherent vowel; dropped below when it ends a word
    } else if (VOWELS[c]) out += VOWELS[c];
    else if (MATRAS[c]) out += MATRAS[c];
    else if (c === "ं" || c === "ँ") out += "n";
    else if (c === "ः") { /* silent */ }
    else out += c;
  }
  return out
    .replace(/([^aeiouA\s])a(?=[\s.,]|$)/g, "$1") // राम -> ram, कुमार -> kumar
    .replace(/A/g, "a")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

/* ── The line table ──────────────────────────────────────────────────── */

type Line = { re: RegExp; hinglish: string; hindi: string };

/** `L("Saved under {name}.", "{name} ke naam par save ho gaya.", ...)`: {x} matches any text
 *  in the English line and is copied into the same place in the translation. */
function L(english: string, hinglish: string, hindi: string): Line {
  const names: string[] = [];
  const src = english.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return "(.+?)"; });
  const to = (s: string) => s.replace(/\{(\w+)\}/g, (_, n) => {
    const k = names.indexOf(n);
    if (k < 0) throw new Error(`i18n: {${n}} is not in "${english}"`);
    return `$${k + 1}`;
  });
  return { re: new RegExp(`^${src}$`), hinglish: to(hinglish), hindi: to(hindi) };
}

/** One line per policy-check count ({c}): "no new policy check", "1 policy check", "N policy checks". */
function CHECKS(english: string, hinglish: string, hindi: string): Line[] {
  const forms: [string, string, string][] = [
    ["no new policy check", "koi naya policy check nahi", "कोई नया पॉलिसी चेक नहीं"],
    ["1 policy check", "1 policy check", "1 पॉलिसी चेक"],
    ["{n} policy checks", "{n} policy checks", "{n} पॉलिसी चेक"],
  ];
  return forms.map(([e, h, d]) => L(english.replace("{c}", e), hinglish.replace("{c}", h), hindi.replace("{c}", d)));
}

// Order matters: a specific line comes before a general one that would also match it.
const LINES: Line[] = [
  /* Help and menus */
  // The numbered menu (templates.ts MENU). Numbers and commands stay as typed.
  L("📋 Here's what I do most. Reply with a number:", "📋 Main yeh kaam sabse zyada karta hoon. Number likhiye:", "📋 मैं ये काम सबसे ज़्यादा करता हूँ। नंबर लिखिए:"),
  L("1) Check a policy: send me the PDF", "1) Policy check: mujhe PDF bhejiye", "1) पॉलिसी चेक: मुझे PDF भेजिए"),
  L("2) Who to call today", "2) Aaj kisko call karna hai", "2) आज किसे कॉल करना है"),
  L("3) Renewals coming up", "3) Aane wale renewals", "3) आने वाले रिन्यूअल"),
  L("4) Add a lead", "4) Nayi lead jodiye", "4) नई लीड जोड़िए"),
  L("5) Find a customer or lead", "5) Customer ya lead dhoondhiye", "5) कस्टमर या लीड ढूँढिए"),
  L("6) Policies that should switch", "6) Badalne layak policies", "6) बदलने लायक पॉलिसियाँ"),
  L("7) How is my book", "7) Meri book kaisi hai", "7) मेरी बुक कैसी है"),
  L("8) Cover calculator", "8) Cover calculator: kitna cover chahiye", "8) कवर कैलकुलेटर: कितना कवर चाहिए"),
  L("9) Compare two plans", "9) Do plans ki tulna", "9) दो प्लान की तुलना"),
  L("Or just type what you need, the way you'd say it. Reply MORE for everything else.",
    "Ya jaise bolte hain waise likh dijiye. Baaki sab ke liye MORE likhiye.",
    "या जैसे बोलते हैं वैसे लिख दीजिए। बाकी सब के लिए MORE लिखिए।"),
  L("👋 Good morning {name}!", "👋 Good morning {name} ji!", "👋 सुप्रभात {name} जी!"),
  L("👋 Good afternoon {name}!", "👋 Namaste {name} ji!", "👋 नमस्ते {name} जी!"),
  L("👋 Good evening {name}!", "👋 Good evening {name} ji!", "👋 शुभ संध्या {name} जी!"),
  L("👋 Good morning!", "👋 Good morning!", "👋 सुप्रभात!"),
  L("👋 Good afternoon!", "👋 Namaste!", "👋 नमस्ते!"),
  L("👋 Good evening!", "👋 Good evening!", "👋 शुभ संध्या!"),

  // MORE: the full list, grouped
  L("📋 Everything I can do. Type it your way, these are just examples:", "📋 Saare kaam. Apne tareeke se likhiye, yeh sirf udaharan hain:", "📋 सारे काम। अपने तरीके से लिखिए, ये सिर्फ़ उदाहरण हैं:"),
  L("*Policies*", "*Policies*", "*पॉलिसी*"),
  L("*Customers and leads*", "*Customers aur leads*", "*कस्टमर और लीड*"),
  L("*Life, claims and tools*", "*Life, claims aur tools*", "*लाइफ़, क्लेम और टूल*"),
  L("*Your business*", "*Aapka business*", "*आपका बिज़नेस*"),
  L("• Send a PDF: I check health policies and save motor, life, term and travel",
    "• PDF bhejiye: health policy check karta hoon, motor, life, term aur travel save karta hoon",
    "• PDF भेजिए: हेल्थ पॉलिसी चेक करता हूँ, मोटर, लाइफ़, टर्म और ट्रैवल सेव करता हूँ"),
  L("• Then ask: room rent? co-pay? waiting period?", "• Phir poochiye: room rent? co-pay? waiting period?", "• फिर पूछिए: room rent? co-pay? waiting period?"),
  L("• SHARE: send the report to the customer", "• SHARE: report customer ko bhejiye", "• SHARE: रिपोर्ट कस्टमर को भेजिए"),
  L("• Premium is 14,500 · Edit this policy · Stop sharing Ramesh's report", "• Premium 14,500 hai · Edit this policy · Ramesh ki report band karo", "• Premium 14,500 hai · Edit this policy · Ramesh की रिपोर्ट बंद करो"),
  L("• Change Amit's phone to 98123 45678 · Make Amit a customer", "• Amit ka number 98123 45678 kar do · Amit ko customer bana do", "• Amit का नंबर 98123 45678 कर दो · Amit को कस्टमर बना दो"),
  L("• What failed? · Is Ramesh's policy done?", "• Kya fail hua? · Ramesh ki policy ho gayi?", "• क्या फ़ेल हुआ? · रमेश की पॉलिसी हो गई?"),
  L("• Policies to switch · Lowest scores · MY CLIENTS", "• Badalni wali policies · Sabse kam score · MY CLIENTS", "• बदलने वाली पॉलिसियाँ · सबसे कम स्कोर · MY CLIENTS"),
  L("• FIND Ramesh · Sunita's portfolio · Is Sunita covered enough?", "• FIND Ramesh · Sunita ka portfolio · Sunita ka cover kaafi hai?", "• FIND Ramesh · सुनीता का पोर्टफोलियो · सुनीता का कवर काफ़ी है?"),
  L("• LEAD Ramesh 98123 45678 health · Ramesh won · follow up Ramesh Friday",
    "• LEAD Ramesh 98123 45678 health · Ramesh ne policy le li · Ramesh ko Friday follow up",
    "• LEAD Ramesh 98123 45678 health · रमेश ने पॉलिसी ले ली · रमेश को शुक्रवार फॉलो अप"),
  L("• RENEWALS · FOLLOW UPS · VIEWS: who opened their report", "• RENEWALS · FOLLOW UPS · VIEWS: kisne report kholi", "• RENEWALS · FOLLOW UPS · VIEWS: किसने रिपोर्ट खोली"),
  L("• Surrender values · SURRENDER VALUE Ramesh", "• Surrender values · SURRENDER VALUE Ramesh", "• सरेंडर वैल्यू · SURRENDER VALUE Ramesh"),
  L("• Open a claim for Sunita · Sunita's claim submitted · Insurer wants the final bill for Sunita's claim",
    "• Sunita ka claim kholo · Sunita ka claim submit ho gaya · Sunita ke claim mein query: final bill chahiye",
    "• Sunita का claim खोलो · Sunita का claim submit हो गया · Sunita के claim में query: final bill चाहिए"),
  L("• Ramesh paid premium 25,000 on 5 Oct 2026 · No loan on Ramesh's policy", "• Ramesh ne 25000 premium bhara 5 Oct 2026 ko · Ramesh ki policy par koi loan nahi", "• Ramesh ने 25000 premium भरा 5 Oct 2026 को · Ramesh की policy पर कोई loan नहीं"),
  L("• CLAIMS · Where is Sunita's claim?", "• CLAIMS · Sunita ka claim kahan tak?", "• CLAIMS · सुनीता का क्लेम कहाँ तक?"),
  L("• How is my book? · Page stats · LINK: your website", "• Meri book kaisi hai? · Page stats · LINK: aapki website", "• मेरी बुक कैसी है? · Page stats · LINK: आपकी वेबसाइट"),
  L("• CHECKS · BALANCE · TODAY · MORNING OFF / ON", "• CHECKS · BALANCE · TODAY · MORNING OFF / ON", "• CHECKS · BALANCE · TODAY · MORNING OFF / ON"),
  L("• HINDI, HINGLISH or ENGLISH: the language I reply in", "• HINDI, HINGLISH ya ENGLISH: jawab kis bhasha mein aaye", "• HINDI, HINGLISH या ENGLISH: जवाब किस भाषा में आए"),

  // Menu choices 1 and 5
  L("📄 Send me the customer's policy PDF right here, the one the insurer emailed.",
    "📄 Customer ki policy ki PDF yahin bhejiye, jo insurer ne email ki thi.",
    "📄 कस्टमर की पॉलिसी की PDF यहीं भेजिए, जो बीमा कंपनी ने ईमेल की थी।"),
  L("Health policies get a full check and a report. Motor, life, term and travel are saved with their details.",
    "Health policy ka poora check aur report milegi. Motor, life, term aur travel unki jaankari ke saath save hongi.",
    "हेल्थ पॉलिसी का पूरा चेक और रिपोर्ट मिलेगी। मोटर, लाइफ़, टर्म और ट्रैवल उनकी जानकारी के साथ सेव होंगी।"),
  L("Tip: write the customer's name and number with the PDF, for example: Ramesh Kumar 98123 45678",
    "Tip: PDF ke saath customer ka naam aur number likhiye, jaise: Ramesh Kumar 98123 45678",
    "सुझाव: PDF के साथ कस्टमर का नाम और नंबर लिखिए, जैसे: Ramesh Kumar 98123 45678"),
  L("Type a name or a phone number, for example: find Ramesh, or find 98123 45678",
    "Naam ya phone number likhiye, jaise: find Ramesh, ya find 98123 45678",
    "नाम या फ़ोन नंबर लिखिए, जैसे: find Ramesh, या find 98123 45678"),
  L("I didn't catch that.", "Samajh nahi aaya.", "समझ नहीं आया।"),
  L("You're welcome. Anything else, just type it.", "Koi baat nahi. Aur kuch chahiye toh bas likh dijiye.", "कोई बात नहीं। और कुछ चाहिए तो बस लिख दीजिए।"),

  /* Talking like a person (converse.ts): hello, did you mean, who do you mean */
  L("👋 Hi {name}!", "👋 Namaste {name} ji!", "👋 नमस्ते {name} जी!"),
  L("👋 Hi!", "👋 Namaste!", "👋 नमस्ते!"),
  L("You have 1 follow-up due. Reply FOLLOW UPS to see them.", "Aapka 1 follow-up due hai. Dekhne ke liye FOLLOW UPS likhiye.", "आपका 1 फॉलो-अप बाकी है। देखने के लिए FOLLOW UPS लिखिए।"),
  L("You have {n} follow-ups due. Reply FOLLOW UPS to see them.", "Aapke {n} follow-ups due hain. Dekhne ke liye FOLLOW UPS likhiye.", "आपके {n} फॉलो-अप बाकी हैं। देखने के लिए FOLLOW UPS लिखिए।"),
  L("I'm not sure I got that. Did you mean:", "Pakka samajh nahi aaya. Kya aapka matlab yeh tha:", "ठीक से समझ नहीं आया। क्या आपका मतलब यह था:"),
  L("Reply with the number, or type HELP to see everything.", "Number likh dijiye, ya sab dekhne ke liye HELP likhiye.", "नंबर लिख दीजिए, या सब देखने के लिए HELP लिखिए।"),
  L("{n}) Everything on {name}", "{n}) {name} ki poori jaankari", "{n}) {name} की पूरी जानकारी"),
  L("{n}) Renewals due", "{n}) Due renewals", "{n}) बाकी रिन्यूअल"),
  L("{n}) Today's follow-ups", "{n}) Aaj ke follow-ups", "{n}) आज के फॉलो-अप"),
  L("{n}) Your leads", "{n}) Aapki leads", "{n}) आपकी लीड"),
  L("{n}) Cover calculator", "{n}) Kitna cover chahiye (calculator)", "{n}) कवर कैलकुलेटर"),
  L("{n}) Compare two plans", "{n}) Do plans ki tulna", "{n}) दो प्लान की तुलना"),
  L("{n}) Claims", "{n}) Claims ka status", "{n}) क्लेम"),
  L("{n}) Your policies", "{n}) Aapki policies", "{n}) आपकी पॉलिसियाँ"),
  L("{n}) Your website link", "{n}) Aapki website ka link", "{n}) आपकी वेबसाइट का लिंक"),
  L("{n}) Policy checks left", "{n}) Bache hue policy checks", "{n}) बचे हुए पॉलिसी चेक"),
  L("{n}) Share a report with a customer", "{n}) Customer ko report bhejiye", "{n}) कस्टमर को रिपोर्ट भेजिए"),
  L("{n}) Write a message for a customer", "{n}) Customer ke liye message", "{n}) कस्टमर के लिए मैसेज"),
  L("{n}) Surrender value (life policies)", "{n}) Surrender value (life policy)", "{n}) सरेंडर वैल्यू (लाइफ़ पॉलिसी)"),
  L("{n}) Who opened their report", "{n}) Kisne report kholi", "{n}) किसने रिपोर्ट खोली"),
  L("Who do you mean? Say it with the name, for example: Ramesh won", "Kiski baat kar rahe hain? Naam ke saath likhiye, jaise: Ramesh ne policy le li", "किसकी बात कर रहे हैं? नाम के साथ लिखिए, जैसे: रमेश ने पॉलिसी ले ली"),
  L("I can't delete anything from WhatsApp, so nothing is lost by mistake. You can remove a lead in the portal: {url}",
    "WhatsApp se main kuch delete nahi karta, taaki galti se kuch na mite. Lead portal mein hata sakte hain: {url}",
    "WhatsApp से मैं कुछ डिलीट नहीं करता, ताकि गलती से कुछ न मिटे। लीड पोर्टल में हटा सकते हैं: {url}"),


  /* Stage 2a: edits to leads, customers and filing (bot.ts editStart ... applyEdit) */
  L("Type it like: change Amit's phone to 98123 45678, or: edit Amit", "Aise likhiye: change Amit's phone to 98123 45678, ya: edit Amit", "ऐसे लिखिए: change Amit's phone to 98123 45678, या: edit Amit"),
  L("I couldn't find a lead or customer called \"{who}\".", "\"{who}\" naam ki koi lead ya customer nahi mila.", "\"{who}\" नाम की कोई लीड या कस्टमर नहीं मिला।"),
  L("{f} is not kept for a lead. For {name} you can change: {list}.", "Lead ke liye {f} nahi rakha jaata. {name} ke liye yeh badal sakte hain: {list}.", "लीड के लिए {f} नहीं रखा जाता। {name} के लिए ये बदल सकते हैं: {list}।"),
  L("{f} is not kept for a customer. For {name} you can change: {list}.", "Customer ke liye {f} nahi rakha jaata. {name} ke liye yeh badal sakte hain: {list}.", "कस्टमर के लिए {f} नहीं रखा जाता। {name} के लिए ये बदल सकते हैं: {list}।"),
  L("What should I change for {name} (lead)?", "{name} (lead) ka kya badlun?", "{name} (लीड) का क्या बदलूँ?"),
  L("What should I change for {name} (customer)?", "{name} (customer) ka kya badlun?", "{name} (कस्टमर) का क्या बदलूँ?"),
  L("{n}) Name: {v}", "{n}) Naam: {v}", "{n}) नाम: {v}"),
  L("{n}) Phone: {v}", "{n}) Phone number: {v}", "{n}) फ़ोन: {v}"),
  L("{n}) Email: {v}", "{n}) Email: {v}", "{n}) ईमेल: {v}"),
  L("{n}) City: {v}", "{n}) Shehar: {v}", "{n}) शहर: {v}"),
  L("{n}) Interested in: {v}", "{n}) Kis mein interest: {v}", "{n}) किसमें रुचि: {v}"),
  L("{n}) Source: {v}", "{n}) Kahan se aaye: {v}", "{n}) कहाँ से आए: {v}"),
  L("{n}) Expected premium: {v}", "{n}) Umeed ka premium: {v}", "{n}) उम्मीद का प्रीमियम: {v}"),
  L("{n}) Date of birth: {v}", "{n}) Janam tithi: {v}", "{n}) जन्म तिथि: {v}"),
  L("Type the new {f} for {name}. Now: {v}", "{name} ka naya {f} likhiye. Abhi: {v}", "{name} का नया {f} लिखिए। अभी: {v}"),
  L("(Or NONE to clear it, CANCEL to stop.)", "(Khali karne ke liye NONE, rokne ke liye CANCEL.)", "(खाली करने के लिए NONE, रोकने के लिए CANCEL।)"),
  L("That {f} doesn't look right ({why}). Type it again, or CANCEL.", "Yeh {f} sahi nahi lag raha ({why}). Phir se likhiye, ya CANCEL.", "यह {f} सही नहीं लग रहा ({why})। फिर से लिखिए, या CANCEL।"),
  L("{name}'s {f} is already {v}. Nothing to change.", "{name} ka {f} pehle se {v} hai. Kuch badalna nahi.", "{name} का {f} पहले से {v} है। कुछ बदलना नहीं।"),
  L("Reply with a number from 1 to {n}, or CANCEL.", "1 se {n} tak ka number likhiye, ya CANCEL.", "1 से {n} तक का नंबर लिखिए, या CANCEL।"),
  L("• {name} (lead): {rest}", "• {name} (lead): {rest}", "• {name} (लीड): {rest}"),
  L("• {name} (customer): {rest}", "• {name} (customer): {rest}", "• {name} (कस्टमर): {rest}"),
  L("• Make {name} a customer. Their phone, email, city and notes are copied, and the lead is marked won",
    "• {name} ko customer banana. Phone, email, shehar aur notes copy honge, aur lead won mark hogi",
    "• {name} को कस्टमर बनाना। फ़ोन, ईमेल, शहर और नोट्स कॉपी होंगे, और लीड won मार्क होगी"),
  L("• Add customer {x} and file {p} under them", "• Customer {x} jodna aur {p} unke naam par rakhna", "• कस्टमर {x} जोड़ना और {p} उनके नाम पर रखना"),
  L("• Add customer {x}", "• Naya customer: {x}", "• नया कस्टमर: {x}"),
  L("• Take {p} out of {name}", "• {p} ko {name} ke naam se hatana", "• {p} को {name} के नाम से हटाना"),
  L("• File {p} under {name} (now under {old})", "• {p} ko {name} ke naam par rakhna (abhi {old} ke naam par)", "• {p} को {name} के नाम पर रखना (अभी {old} के नाम पर)"),
  L("• File {p} under {name}", "• {p} ko {name} ke naam par rakhna", "• {p} को {name} के नाम पर रखना"),
  L("• Undo: remove the customer {name} you just added", "• Undo: abhi jode customer {name} ko hatana", "• Undo: अभी जोड़े कस्टमर {name} को हटाना"),
  L("• Undo: make {name} a lead again", "• Undo: {name} ko phir se lead banana", "• Undo: {name} को फिर से लीड बनाना"),
  L("• Undo: {f} of {name} back to {v}", "• Undo: {name} ka {f} wapas {v}", "• Undo: {name} का {f} वापस {v}"),
  L("• Undo: put {p} back where it was filed", "• Undo: {p} ko pehle wali jagah wapas rakhna", "• Undo: {p} को पहले वाली जगह वापस रखना"),
  L("• Undo: put {n} changes back as they were", "• Undo: {n} badlav pehle jaise karna", "• Undo: {n} बदलाव पहले जैसे करना"),
  L("✅ Saved. {name}: {f} is now {v}.", "✅ Save ho gaya. {name}: {f} ab {v} hai.", "✅ सेव हो गया। {name}: {f} अब {v} है।"),
  L("✅ {name} is now a customer.", "✅ {name} ab customer hain.", "✅ {name} अब कस्टमर हैं।"),
  L("{name} is already your customer, with that phone number.", "{name} us phone number ke saath pehle se aapke customer hain.", "{name} उस फ़ोन नंबर के साथ पहले से आपके कस्टमर हैं।"),
  L("✅ Customer {name} added.", "✅ Customer {name} jud gaye.", "✅ कस्टमर {name} जुड़ गए।"),
  L("✅ Filed: {p} is now under {name}.", "✅ Ho gaya: {p} ab {name} ke naam par hai.", "✅ हो गया: {p} अब {name} के नाम पर है।"),
  L("✅ {p} is no longer filed under {name}.", "✅ {p} ab {name} ke naam par nahi hai.", "✅ {p} अब {name} के नाम पर नहीं है।"),
  L("Not saved: {name} was changed in the portal a moment ago. Ask again to see the latest.", "Save nahi hua: {name} abhi portal mein badla gaya. Nayi jaankari ke liye phir se poochiye.", "सेव नहीं हुआ: {name} अभी पोर्टल में बदला गया। नई जानकारी के लिए फिर से पूछिए।"),
  L("Not saved: I couldn't find {name} any more.", "Save nahi hua: {name} ab nahi mil raha.", "सेव नहीं हुआ: {name} अब नहीं मिल रहा।"),
  L("Not saved: {why}.", "Save nahi hua: {why}.", "सेव नहीं हुआ: {why}।"),
  L("{name} is already a customer.", "{name} pehle se customer hain.", "{name} पहले से कस्टमर हैं।"),
  L("That can't be undone here any more: it was changed since, or something was added to it. Please fix it in the portal.", "Yeh ab yahan se undo nahi ho sakta: isme badlav hua ya kuch joda gaya. Portal mein theek kijiye.", "यह अब यहाँ से undo नहीं हो सकता: इसमें बदलाव हुआ या कुछ जोड़ा गया। पोर्टल में ठीक कीजिए।"),
  L("Undone: removed the customer {name}.", "Undo ho gaya: customer {name} hata diya.", "Undo हो गया: कस्टमर {name} हटा दिया।"),
  L("The customer {name} stays: something was added to it or it was changed. Remove it in the portal if needed.", "Customer {name} rahenge: unme kuch joda gaya ya badla gaya. Zarurat ho to portal mein hataiye.", "कस्टमर {name} रहेंगे: उनमें कुछ जोड़ा गया या बदला गया। ज़रूरत हो तो पोर्टल में हटाइए।"),
  L("Undone: {name} is a lead again.", "Undo ho gaya: {name} phir se lead hain.", "Undo हो गया: {name} फिर से लीड हैं।"),
  L("Undone: {n} changes are back as they were.", "Undo ho gaya: {n} badlav pehle jaise ho gaye.", "Undo हो गया: {n} बदलाव पहले जैसे हो गए।"),
  L("Type it like: make Amit a customer", "Aise likhiye: make Amit a customer", "ऐसे लिखिए: make Amit a customer"),
  L("I couldn't find a lead called \"{who}\".", "\"{who}\" naam ki koi lead nahi mili.", "\"{who}\" नाम की कोई लीड नहीं मिली।"),
  L("Type it like: add customer Sunita Rao 98123 45678, Pune", "Aise likhiye: add customer Sunita Rao 98123 45678, Pune", "ऐसे लिखिए: add customer Sunita Rao 98123 45678, Pune"),
  L("That doesn't look right ({why}). Type it like: add customer Sunita Rao 98123 45678, Pune", "Yeh sahi nahi lag raha ({why}). Aise likhiye: add customer Sunita Rao 98123 45678, Pune", "यह सही नहीं लग रहा ({why})। ऐसे लिखिए: add customer Sunita Rao 98123 45678, Pune"),
  L("Type it like: file Ramesh's policy under Sunita", "Aise likhiye: file Ramesh's policy under Sunita", "ऐसे लिखिए: file Ramesh's policy under Sunita"),
  L("Which policy? For example: file Ramesh's policy under Sunita", "Kaunsi policy? Jaise: file Ramesh's policy under Sunita", "कौन सी पॉलिसी? जैसे: file Ramesh's policy under Sunita"),
  L("{p} is not filed under any customer.", "{p} kisi customer ke naam par nahi hai.", "{p} किसी कस्टमर के नाम पर नहीं है।"),
  L("{p} is already filed under {name}.", "{p} pehle se {name} ke naam par hai.", "{p} पहले से {name} के नाम पर है।"),
  L("This policy has no policyholder name to make a customer from. Type it like: add customer Sunita Rao 98123 45678",
    "Is policy par policyholder ka naam nahi hai. Aise likhiye: add customer Sunita Rao 98123 45678",
    "इस पॉलिसी पर पॉलिसीधारक का नाम नहीं है। ऐसे लिखिए: add customer Sunita Rao 98123 45678"),
  L("No customer called \"{c}\" yet. Add them first: add customer {x}", "\"{c}\" naam ka koi customer abhi nahi. Pehle jodiye: add customer {x}", "\"{c}\" नाम का कोई कस्टमर अभी नहीं। पहले जोड़िए: add customer {x}"),
  L("Which customer?", "Kaunsa customer?", "कौन सा कस्टमर?"),
  L("I couldn't find \"{c}\" any more.", "\"{c}\" ab nahi mil raha.", "\"{c}\" अब नहीं मिल रहा।"),
  L("I couldn't find {name} any more.", "{name} ab nahi mil raha.", "{name} अब नहीं मिल रहा।"),
  /* Stage 2d: life records (bot.ts lifeStart ... lifeRecord). Specific lines before general ones. */
  L("Type it like: Ramesh paid premium 25,000 on 5 Oct 2026", "Aise likhiye: Ramesh ne 25000 premium bhara 5 Oct 2026 ko", "ऐसे लिखिए: Ramesh ने 25000 premium भरा 5 Oct 2026 को"),
  L("I couldn't find a life or term policy for \"{who}\".", "\"{who}\" ki koi life ya term policy nahi mili.", "\"{who}\" की कोई life या term पॉलिसी नहीं मिली।"),
  L("Which policy? For example: Ramesh paid premium 25,000 on 5 Oct 2026", "Kaunsi policy? Jaise: Ramesh ne 25000 premium bhara 5 Oct 2026 ko", "कौन सी पॉलिसी? जैसे: Ramesh ने 25000 premium भरा 5 Oct 2026 को"),
  L("{p} is not a life or term policy. These records are kept only on life and term policies.", "{p} life ya term policy nahi hai. Yeh records sirf life aur term policy par rakhe jaate hain.", "{p} life या term पॉलिसी नहीं है। ये रिकॉर्ड सिर्फ़ life और term पॉलिसी पर रखे जाते हैं।"),
  L("That amount doesn't look right (\"{a}\"). Type it like: Ramesh paid premium 25,000 on 5 Oct 2026", "Yeh amount sahi nahi lag raha (\"{a}\"). Aise likhiye: Ramesh ne 25000 premium bhara 5 Oct 2026 ko", "यह रकम सही नहीं लग रही (\"{a}\")। ऐसे लिखिए: Ramesh ने 25000 premium भरा 5 Oct 2026 को"),
  L("That amount doesn't look right (\"{a}\").", "Yeh amount sahi nahi lag raha (\"{a}\").", "यह रकम सही नहीं लग रही (\"{a}\")।"),
  L("That payment date doesn't look right. Type a date up to today, like 5 Oct 2026.", "Yeh payment date sahi nahi lag rahi. Aaj tak ki date likhiye, jaise 5 Oct 2026.", "यह भुगतान की तारीख़ सही नहीं लग रही। आज तक की तारीख़ लिखिए, जैसे 5 Oct 2026।"),
  L("{p} already has a payment of {a} for the premium due {d}. Nothing to add.", "{p} par {d} wale premium ka {a} ka payment pehle se hai. Kuch jodna nahi.", "{p} पर {d} वाले premium का {a} का भुगतान पहले से है। कुछ जोड़ना नहीं।"),
  L("• Undo: remove the record just added to {p}. It stays in the policy's history, marked removed", "• Undo: {p} par abhi joda record hatana. Policy ki history mein 'hataya gaya' likha rahega", "• Undo: {p} पर अभी जोड़ा रिकॉर्ड हटाना। पॉलिसी की हिस्ट्री में 'हटाया गया' लिखा रहेगा"),
  L("Undone: the record on {p} is removed. The policy's history keeps it, marked removed.", "Undo ho gaya: {p} ka record hata diya. Policy ki history mein 'hataya gaya' likha rahega.", "Undo हो गया: {p} का रिकॉर्ड हटा दिया। पॉलिसी की हिस्ट्री में 'हटाया गया' लिखा रहेगा।"),
  L("Not saved: {p} already has that payment.", "Save nahi hua: {p} par yeh payment pehle se hai.", "सेव नहीं हुआ: {p} पर यह भुगतान पहले से है।"),
  L("Not saved: {p} has details that are only in the portal. Please add it there.", "Save nahi hua: {p} ki kuch details sirf portal mein hain. Wahin jodiye.", "सेव नहीं हुआ: {p} की कुछ जानकारी सिर्फ़ पोर्टल में है। वहीं जोड़िए।"),
  L("Which premium does this payment cover?", "Yeh payment kaunse premium ka hai?", "यह भुगतान किस प्रीमियम का है?"),
  L("{n}) due {d}", "{n}) due {d}", "{n}) due {d}"),
  L("No premium on {p} was due by then.", "{p} par tab tak koi premium due nahi tha.", "{p} पर तब तक कोई प्रीमियम due नहीं था।"),
  L("{d} is not a premium due date on {p}. Recent due dates: {list}.", "{d} {p} ki premium due date nahi hai. Haal ki due dates: {list}.", "{d} {p} की प्रीमियम due date नहीं है। हाल की due dates: {list}।"),
  L("{p}'s premium schedule is not complete (start date, how often premiums are paid, or the term is missing), so a payment can't be matched to a due date. Fill those in the portal first.",
    "{p} ka premium schedule poora nahi hai (start date, premium kitni baar bharte hain, ya term nahi hai), isliye payment kisi due date se nahi mil sakta. Pehle portal mein bhariye.",
    "{p} का प्रीमियम शेड्यूल पूरा नहीं है (start date, प्रीमियम कितनी बार भरते हैं, या term नहीं है), इसलिए भुगतान किसी due date से नहीं मिल सकता। पहले पोर्टल में भरिए।"),
  L("{p} is still being read. Try again when it is done.", "{p} abhi padhi ja rahi hai. Ho jaane par phir koshish kijiye.", "{p} अभी पढ़ी जा रही है। हो जाने पर फिर कोशिश कीजिए।"),
  L("Not saved: {p} is still being read. Try again when it is done.", "Save nahi hua: {p} abhi padhi ja rahi hai. Ho jaane par phir koshish kijiye.", "सेव नहीं हुआ: {p} अभी पढ़ी जा रही है। हो जाने पर फिर कोशिश कीजिए।"),
  L("Not saved: {p} is not a life or term policy.", "Save nahi hua: {p} life ya term policy nahi hai.", "सेव नहीं हुआ: {p} life या term पॉलिसी नहीं है।"),
  L("Not saved: that due date is not on {p}'s premium schedule. Check the policy's start date, frequency and term in the portal.", "Save nahi hua: yeh due date {p} ke premium schedule mein nahi hai. Portal mein policy ki start date, frequency aur term dekhiye.", "सेव नहीं हुआ: यह due date {p} के प्रीमियम शेड्यूल में नहीं है। पोर्टल में पॉलिसी की start date, frequency और term देखिए।"),
  L("That date doesn't look right. Type the last due date that is paid, up to today, like 1 Oct 2026.", "Yeh date sahi nahi lag rahi. Aakhri bhari hui due date likhiye, aaj tak ki, jaise 1 Oct 2026.", "यह तारीख़ सही नहीं लग रही। आख़िरी भरी हुई due date लिखिए, आज तक की, जैसे 1 Oct 2026।"),
  L("That date doesn't look right. Type the date of the insurer's statement, up to today, like 5 Oct 2026.", "Yeh date sahi nahi lag rahi. Insurer ke statement ki date likhiye, aaj tak ki, jaise 5 Oct 2026.", "यह तारीख़ सही नहीं लग रही। इंश्योरर के स्टेटमेंट की तारीख़ लिखिए, आज तक की, जैसे 5 Oct 2026।"),
  L("What date is the insurer's statement or message from? Type a date like 5 Oct 2026, or TODAY.", "Insurer ka statement ya message kis date ka hai? Date likhiye jaise 5 Oct 2026, ya TODAY.", "इंश्योरर का स्टेटमेंट या मैसेज किस तारीख़ का है? तारीख़ लिखिए जैसे 5 Oct 2026, या TODAY।"),
  L("(CANCEL to do something else.)", "(Kuch aur karna ho to CANCEL.)", "(कुछ और करना हो तो CANCEL।)"),
  L("Type the date like 5 Oct 2026, or TODAY. (CANCEL to do something else.)", "Date aise likhiye: 5 Oct 2026, ya TODAY. (Kuch aur karna ho to CANCEL.)", "तारीख़ ऐसे लिखिए: 5 Oct 2026, या TODAY। (कुछ और करना हो तो CANCEL।)"),
  /* Stage 2c: claims (bot.ts claimStart ... applyClaim). Specific lines before general ones. */
  L("Type it like: open a claim for Sunita, or: Sunita's claim submitted", "Aise likhiye: Sunita ka claim kholo, ya: Sunita ka claim submit ho gaya", "ऐसे लिखिए: Sunita का claim खोलो, या: Sunita का claim submit हो गया"),
  L("Settling or rejecting a claim is done in the portal, where you attach the insurer's letter.", "Claim settle ya reject portal mein hota hai, jahan insurer ka letter lagate hain.", "क्लेम settle या reject पोर्टल में होता है, जहाँ इंश्योरर का लेटर लगाते हैं।"),
  L("I couldn't find a claim for \"{who}\".", "\"{who}\" ka koi claim nahi mila.", "\"{who}\" का कोई क्लेम नहीं मिला।"),
  L("Not saved: {c} is closed. Change it in the portal.", "Save nahi hua: {c} band ho chuka hai. Portal mein badaliye.", "सेव नहीं हुआ: {c} बंद हो चुका है। पोर्टल में बदलिए।"),
  L("Not saved: {c}'s documents can't be kept longer now. It has had its one extension, or it is not yet in the last 5 days.",
    "Save nahi hua: {c} ke documents ab aur nahi rakh sakte. Ek baar badha chuke hain, ya abhi aakhri 5 din nahi aaye.",
    "सेव नहीं हुआ: {c} के डॉक्यूमेंट अब और नहीं रख सकते। एक बार बढ़ा चुके हैं, या अभी आख़िरी 5 दिन नहीं आए।"),
  L("{c} is closed. Change it in the portal.", "{c} band ho chuka hai. Portal mein badaliye.", "{c} बंद हो चुका है। पोर्टल में बदलिए।"),
  L("Which claim?", "Kaunsa claim?", "कौन सा क्लेम?"),
  L("Which claim? For example: Sunita's claim submitted", "Kaunsa claim? Jaise: Sunita ka claim submit ho gaya", "कौन सा क्लेम? जैसे: Sunita का claim submit हो गया"),
  L("I couldn't find that claim any more.", "Woh claim ab nahi mil raha.", "वह क्लेम अब नहीं मिल रहा।"),
  L("{c} is already at \"{s}\". Nothing to change.", "{c} pehle se \"{s}\" par hai. Kuch badalna nahi.", "{c} पहले से \"{s}\" पर है। कुछ बदलना नहीं।"),
  L("{c} has no open insurer query.", "{c} mein insurer ki koi khuli query nahi hai.", "{c} में इंश्योरर की कोई खुली query नहीं है।"),
  L("Which query was answered?", "Kis query ka jawab diya?", "किस query का जवाब दिया?"),
  L("Documents can be kept 30 more days only once, in the last 5 days before they are deleted, while the claim is open.",
    "Documents sirf ek baar 30 din aur rakh sakte hain, mitne se pehle ke aakhri 5 dinon mein, jab tak claim khula hai.",
    "डॉक्यूमेंट सिर्फ़ एक बार 30 दिन और रख सकते हैं, मिटने से पहले के आख़िरी 5 दिनों में, जब तक क्लेम खुला है।"),
  L("{f} can't be changed from WhatsApp.", "{f} WhatsApp se nahi badal sakte.", "{f} WhatsApp से नहीं बदल सकते।"),
  L("Is {name}'s claim cashless or reimbursement?", "{name} ka claim cashless hai ya reimbursement?", "{name} का क्लेम cashless है या reimbursement?"),
  L("• Open a {t} claim for {name}. Note: {x} already has an open claim ({s})", "• {name} ka {t} claim kholna. Dhyan dein: {x} ka ek claim pehle se khula hai ({s})", "• {name} का {t} क्लेम खोलना। ध्यान दें: {x} का एक क्लेम पहले से खुला है ({s})"),
  L("Not saved: {c} has an insurer query still open. Mark it answered first.", "Save nahi hua: {c} mein insurer ki query abhi khuli hai. Pehle use answered kijiye.", "सेव नहीं हुआ: {c} में इंश्योरर की query अभी खुली है। पहले उसे answered कीजिए।"),
  L("{c} has an insurer query still open. When it is answered, type: {x} query answered", "{c} mein insurer ki query abhi khuli hai. Jawab dene ke baad likhiye: {x} query answered", "{c} में इंश्योरर की query अभी खुली है। जवाब देने के बाद लिखिए: {x} query answered"),
  L("• Open a {t} claim for {name}", "• {name} ka {t} claim kholna", "• {name} का {t} क्लेम खोलना"),
  L("• {c}: log the insurer's query \"{q}\". The claim moves to \"Insurer query open\". There is no undo for this; remove it in the portal if needed",
    "• {c}: insurer ki query \"{q}\" likhna. Claim \"Insurer query open\" par jayega. Iska undo nahi hai; zarurat ho to portal mein hataiye",
    "• {c}: इंश्योरर की query \"{q}\" लिखना। क्लेम \"Insurer query open\" पर जाएगा। इसका undo नहीं है; ज़रूरत हो तो पोर्टल में हटाइए"),
  L("• {c}: query round {n} (\"{q}\") answered", "• {c}: query round {n} (\"{q}\") ka jawab de diya", "• {c}: query round {n} (\"{q}\") का जवाब दे दिया"),
  L("• {c}: keep the documents 30 more days. This is the one extension and can't be undone",
    "• {c}: documents 30 din aur rakhna. Yeh ek hi baar hota hai aur undo nahi hoga",
    "• {c}: डॉक्यूमेंट 30 दिन और रखना। यह एक ही बार होता है और undo नहीं होगा"),
  L("• Undo: remove the claim you just opened for {name}", "• Undo: {name} ka abhi khola claim hatana", "• Undo: {name} का अभी खोला क्लेम हटाना"),
  L("• Undo: query round {n} on {c} open again", "• Undo: {c} ka query round {n} phir se khula", "• Undo: {c} का query round {n} फिर से खुला"),
  L("• Undo: {c} back to \"{s}\"", "• Undo: {c} wapas \"{s}\" par", "• Undo: {c} वापस \"{s}\" पर"),
  L("• {c}: \"{a}\" → \"{z}\"", "• {c}: \"{a}\" → \"{z}\"", "• {c}: \"{a}\" → \"{z}\""),
  L("✅ Claim opened for {name} ({t}).", "✅ {name} ka claim khul gaya ({t}).", "✅ {name} का क्लेम खुल गया ({t})।"),
  L("Add its details like: {c} hospital is Apollo", "Details aise jodiye: {c} hospital is Apollo", "जानकारी ऐसे जोड़िए: {c} hospital is Apollo"),
  L("✅ {c} is now at \"{s}\".", "✅ {c} ab \"{s}\" par hai.", "✅ {c} अब \"{s}\" पर है।"),
  L("✅ Query round {n} logged on {c}. When you have replied to the insurer, type: {x} query answered",
    "✅ {c} par query round {n} likh diya. Insurer ko jawab dene ke baad likhiye: {x} query answered",
    "✅ {c} पर query round {n} लिख दिया। इंश्योरर को जवाब देने के बाद लिखिए: {x} query answered"),
  L("✅ Query round {n} on {c} is answered. It is back at \"{s}\".", "✅ {c} ka query round {n} ho gaya. Claim wapas \"{s}\" par hai.", "✅ {c} का query round {n} हो गया। क्लेम वापस \"{s}\" पर है।"),
  L("✅ Query round {n} on {c} is answered. {k} more query still open.", "✅ {c} ka query round {n} ho gaya. {k} aur query abhi khuli hai.", "✅ {c} का query round {n} हो गया। {k} और query अभी खुली है।"),
  L("✅ Query round {n} on {c} is answered.", "✅ {c} ka query round {n} ho gaya.", "✅ {c} का query round {n} हो गया।"),
  L("✅ {c}: documents kept 30 more days, until {d}. That was its one extension.", "✅ {c}: documents 30 din aur rahenge, {d} tak. Yeh ek hi baar hota hai.", "✅ {c}: डॉक्यूमेंट 30 दिन और रहेंगे, {d} तक। यह एक ही बार होता है।"),
  L("Undone: removed the claim for {name}.", "Undo ho gaya: {name} ka claim hata diya.", "Undo हो गया: {name} का क्लेम हटा दिया।"),
  /* Stage 2b: policies (bot.ts policyFixStart ... unshareWith) */
  L("Type it like: premium is 14,500, or: edit this policy", "Aise likhiye: premium 14,500 hai, ya: edit this policy", "ऐसे लिखिए: premium 14,500 hai, या: edit this policy"),
  L("Which policy? For example: change Ramesh's car policy premium to 14500", "Kaunsi policy? Jaise: Ramesh ki car policy ka premium 14500 kar do", "कौन सी पॉलिसी? जैसे: Ramesh की car policy का premium 14500 कर दो"),
  L("What should I change on {p}?", "{p} mein kya badlun?", "{p} में क्या बदलूँ?"),
  L("{f} can't be changed from WhatsApp. On {p} you can change: {list}.", "{f} WhatsApp se nahi badal sakte. {p} mein yeh badal sakte hain: {list}.", "{f} WhatsApp से नहीं बदल सकते। {p} में ये बदल सकते हैं: {list}।"),
  L("On a health policy, the details come from the policy check and can't be changed here. You can change: {list}.",
    "Health policy ki details policy check se aati hain, yahan nahi badal sakte. Yeh badal sakte hain: {list}.",
    "हेल्थ पॉलिसी की जानकारी पॉलिसी चेक से आती है, यहाँ नहीं बदल सकते। ये बदल सकते हैं: {list}।"),
  L("(CANCEL to stop.)", "(Rokne ke liye CANCEL.)", "(रोकने के लिए CANCEL।)"),
  L("{p}: {f} is already {v}. Nothing to change.", "{p}: {f} pehle se {v} hai. Kuch badalna nahi.", "{p}: {f} पहले से {v} है। कुछ बदलना नहीं।"),
  L("Not saved: {p} has details that are only in the portal. Please change it there.", "Save nahi hua: {p} ki kuch details sirf portal mein hain. Wahin badaliye.", "सेव नहीं हुआ: {p} की कुछ जानकारी सिर्फ़ पोर्टल में है। वहीं बदलिए।"),
  L("• Stop sharing {p}. The customer's link stops opening until you share it again", "• {p} ki sharing band. Jab tak dobara share na karein, customer ka link nahi khulega", "• {p} की शेयरिंग बंद। जब तक दोबारा शेयर न करें, कस्टमर का लिंक नहीं खुलेगा"),
  L("• Undo: share {p} again (same link)", "• Undo: {p} phir se share karna (wahi link)", "• Undo: {p} फिर से शेयर करना (वही लिंक)"),
  L("✅ Sharing stopped for {p}. The customer's link no longer opens.", "✅ {p} ki sharing band ho gayi. Customer ka link ab nahi khulega.", "✅ {p} की शेयरिंग बंद हो गई। कस्टमर का लिंक अब नहीं खुलेगा।"),
  L("To share it again, ask me to share it. The link stays the same.", "Dobara share karna ho to bas boliye. Link wahi rahega.", "दोबारा शेयर करना हो तो बस बोलिए। लिंक वही रहेगा।"),
  L("{p} is not being shared. Nothing to stop.", "{p} share nahi ho rahi. Band karne ko kuch nahi.", "{p} शेयर नहीं हो रही। बंद करने को कुछ नहीं।"),
  L("I couldn't find a shared report for \"{who}\".", "\"{who}\" ki koi share ki hui report nahi mili.", "\"{who}\" की कोई शेयर की हुई रिपोर्ट नहीं मिली।"),
  L("Which report should I stop sharing? For example: stop sharing Ramesh's report", "Kaunsi report band karun? Jaise: Ramesh ki report band karo", "कौन सी रिपोर्ट बंद करूँ? जैसे: Ramesh की रिपोर्ट बंद करो"),
  /* Stage 1: read-only views of the book (bookReplies.ts) */
  L("✅ Nothing failed, and no checks are running right now.", "✅ Koi check fail nahi hua, aur abhi koi check chal bhi nahi raha.", "✅ कोई चेक फ़ेल नहीं हुआ, और अभी कोई चेक चल भी नहीं रहा।"),
  L("⚠️ 1 check could not finish:", "⚠️ 1 check poora nahi ho paya:", "⚠️ 1 चेक पूरा नहीं हो पाया:"),
  L("⚠️ {n} checks could not finish:", "⚠️ {n} checks poore nahi ho paye:", "⚠️ {n} चेक पूरे नहीं हो पाए:"),
  L("Send the PDF again to retry, or fix it in My Queue:", "Dobara try karne ke liye PDF phir se bhejiye, ya My Queue mein theek kijiye:", "दोबारा कोशिश के लिए PDF फिर से भेजिए, या My Queue में ठीक कीजिए:"),
  L("⏳ Still being checked: {names}", "⏳ Abhi check ho rahe hain: {names}", "⏳ अभी चेक हो रहे हैं: {names}"),
  L("✅ {who}: ready.", "✅ {who}: ready hai.", "✅ {who}: तैयार है।"),
  L("⚠️ {who}: could not finish ({why}). Send the PDF again to retry.", "⚠️ {who}: poora nahi ho paya ({why}). Dobara try karne ke liye PDF phir se bhejiye.", "⚠️ {who}: पूरा नहीं हो पाया ({why})। दोबारा कोशिश के लिए PDF फिर से भेजिए।"),
  L("⚠️ {who}: could not finish. Send the PDF again to retry.", "⚠️ {who}: poora nahi ho paya. Dobara try karne ke liye PDF phir se bhejiye.", "⚠️ {who}: पूरा नहीं हो पाया। दोबारा कोशिश के लिए PDF फिर से भेजिए।"),
  L("⏳ {who}: still being checked. It usually takes a minute or two.", "⏳ {who}: abhi check ho rahi hai. Aam taur par ek-do minute lagte hain.", "⏳ {who}: अभी चेक हो रही है। आमतौर पर एक-दो मिनट लगते हैं।"),
  L("I couldn't find a policy for \"{q}\". Type CHECKS to see what you have left, or send the PDF.", "\"{q}\" ki koi policy nahi mili. Bache checks dekhne ke liye CHECKS likhiye, ya PDF bhejiye.", "\"{q}\" की कोई पॉलिसी नहीं मिली। बचे चेक देखने के लिए CHECKS लिखिए, या PDF भेजिए।"),

  L("📋 Should switch (health score under 70): {n}", "📋 Badalni chahiye (health score 70 se kam): {n}", "📋 बदलनी चाहिए (हेल्थ स्कोर 70 से कम): {n}"),
  L("📋 Healthy (health score 70 or more): {n}", "📋 Achhi policies (health score 70 ya zyada): {n}", "📋 अच्छी पॉलिसियाँ (हेल्थ स्कोर 70 या ज़्यादा): {n}"),
  L("📋 Lowest health scores first: {n}", "📋 Sabse kam health score pehle: {n}", "📋 सबसे कम हेल्थ स्कोर पहले: {n}"),
  L("📋 Expiring in the next 30 days: {n}", "📋 Agle 30 din mein khatam: {n}", "📋 अगले 30 दिन में ख़त्म: {n}"),
  L("📋 Your policies: {n}", "📋 Aapki policies: {n}", "📋 आपकी पॉलिसियाँ: {n}"),
  L("Should switch (health score under 70): none right now.", "Badalne layak (health score 70 se kam): abhi koi nahi.", "बदलने लायक (हेल्थ स्कोर 70 से कम): अभी कोई नहीं।"),
  L("Healthy (health score 70 or more): none right now.", "Achhi policies (health score 70 ya zyada): abhi koi nahi.", "अच्छी पॉलिसियाँ (हेल्थ स्कोर 70 या ज़्यादा): अभी कोई नहीं।"),
  L("Lowest health scores first: none right now.", "Health score wali koi policy abhi nahi.", "हेल्थ स्कोर वाली कोई पॉलिसी अभी नहीं।"),
  L("In your book: {a} policies · {b} expiring soon · {c} should switch · {d} healthy", "Aapki book mein: {a} policies · {b} jaldi khatam · {c} badalni chahiye · {d} achhi", "आपकी बुक में: {a} पॉलिसियाँ · {b} जल्दी ख़त्म · {c} बदलनी चाहिए · {d} अच्छी"),
  L("…and {n} more in the portal.", "…aur {n} portal mein.", "…और {n} पोर्टल में।"),

  L("I couldn't find a customer called \"{q}\". Customers are added in the portal, or when you file a policy under a name.", "\"{q}\" naam ka koi customer nahi mila. Customer portal mein judte hain, ya policy kisi naam par save karne se.", "\"{q}\" नाम का कोई कस्टमर नहीं मिला। कस्टमर पोर्टल में जुड़ते हैं, या पॉलिसी किसी नाम पर सेव करने से।"),
  L("More than one customer matches \"{q}\":", "\"{q}\" naam ke ek se zyada customer hain:", "\"{q}\" नाम के एक से ज़्यादा कस्टमर हैं:"),
  L("Say the full name, for example: {x} portfolio", "Poora naam likhiye, jaise: {x} portfolio", "पूरा नाम लिखिए, जैसे: {x} portfolio"),
  L("👤 {name}: 1 policy", "👤 {name}: 1 policy", "👤 {name}: 1 पॉलिसी"),
  L("👤 {name}: {n} policies", "👤 {name}: {n} policies", "👤 {name}: {n} पॉलिसियाँ"),
  L("No checked policies filed under this customer yet.", "Is customer ke naam par abhi koi checked policy nahi hai.", "इस कस्टमर के नाम पर अभी कोई चेक की हुई पॉलिसी नहीं है।"),
  L("Types: {x}", "Prakar: {x}", "प्रकार: {x}"),
  L("Total cover: {x}", "Kul cover: {x}", "कुल कवर: {x}"),
  L("Yearly premium on file (non-health): {x}", "Saalana premium record mein (health chhodkar): {x}", "सालाना प्रीमियम रिकॉर्ड में (हेल्थ छोड़कर): {x}"),
  L("Next premium: {x}", "Agla premium: {x}", "अगला प्रीमियम: {x}"),
  L("Should switch: {x} scored under 70", "Badalni chahiye: {x} ka score 70 se kam", "बदलनी चाहिए: {x} का स्कोर 70 से कम"),
  L("Health cover: {a} of {b} recommended (last calculator).", "Health cover: {b} mein se {a} (pichhla calculator).", "हेल्थ कवर: {b} में से {a} (पिछला कैलकुलेटर)।"),
  L("Gap: {x} short.", "Kami: {x}.", "कमी: {x}।"),
  L("Covered enough by that calculation.", "Us calculation ke hisaab se cover kaafi hai.", "उस हिसाब से कवर काफ़ी है।"),
  L("Health cover: {a}. No calculator saved for this customer, so no gap to show. Try: calculator for {name}", "Health cover: {a}. Is customer ka koi calculator save nahi hai, isliye kami nahi bata sakte. Try kijiye: calculator for {name}", "हेल्थ कवर: {a}। इस कस्टमर का कोई कैलकुलेटर सेव नहीं है, इसलिए कमी नहीं बता सकते। आज़माइए: calculator for {name}"),

  L("No life or term policies yet. Send one as a PDF to add it.", "Abhi koi life ya term policy nahi hai. Jodne ke liye PDF bhejiye.", "अभी कोई लाइफ़ या टर्म पॉलिसी नहीं है। जोड़ने के लिए PDF भेजिए।"),
  L("📋 Surrender values: {x}", "📋 Surrender values: {x}", "📋 सरेंडर वैल्यू: {x}"),
  L("Insurer quotes you entered: Not available", "Aapke daale insurer quotes: Uplabdh nahi", "आपके डाले बीमा कंपनी के कोट: उपलब्ध नहीं"),
  L("Calculated from checked policy terms: Not available", "Checked policy terms se nikala: Uplabdh nahi", "चेक की हुई पॉलिसी शर्तों से निकाला: उपलब्ध नहीं"),
  L("Insurer quotes you entered: {x}", "Aapke daale insurer quotes: {x}", "आपके डाले बीमा कंपनी के कोट: {x}"),
  L("Calculated from checked policy terms: {x}", "Checked policy terms se nikala: {x}", "चेक की हुई पॉलिसी शर्तों से निकाला: {x}"),
  L("Need your attention: {n}", "Aapka dhyan chahiye: {n}", "आपका ध्यान चाहिए: {n}"),
  L("Maturing in the next 12 months: {n}", "Agle 12 mahine mein maturity: {n}", "अगले 12 महीने में मैच्योरिटी: {n}"),
  L("Totals add only insurer quotes and values calculated from checked terms, kept apart. Confirm with the insurer before acting.", "Total mein sirf insurer quotes aur checked terms se nikali values judti hain, alag-alag. Kuch karne se pehle insurer se pakka kijiye.", "टोटल में सिर्फ़ बीमा कंपनी के कोट और चेक की हुई शर्तों से निकली वैल्यू जुड़ती हैं, अलग-अलग। कुछ करने से पहले बीमा कंपनी से पक्का कीजिए।"),
  ...([
    ["Still being read. Check back shortly.", "Abhi padhi ja rahi hai. Thodi der mein dekhiye.", "अभी पढ़ी जा रही है। थोड़ी देर में देखिए।"],
    ["Could not be read. Re-upload the PDF.", "Padhi nahi ja saki. PDF phir se upload kijiye.", "पढ़ी नहीं जा सकी। PDF फिर से अपलोड कीजिए।"],
    ["Fill in the missing details on the policy.", "Policy ki bachi jaankari bhariye.", "पॉलिसी की बची जानकारी भरिए।"],
    ["Confirm the plan type on the policy.", "Policy ka plan type pakka kijiye.", "पॉलिसी का प्लान टाइप पक्का कीजिए।"],
    ["Ask the insurer.", "Insurer se poochiye.", "बीमा कंपनी से पूछिए।"],
    ["Check the details against the policy document.", "Jaankari policy document se milaiye.", "जानकारी पॉलिसी डॉक्यूमेंट से मिलाइए।"],
    ["Record which premiums were paid.", "Kaun se premium bhare gaye, record kijiye.", "कौन से प्रीमियम भरे गए, रिकॉर्ड कीजिए।"],
    ["Ask the insurer for a surrender quote and enter it.", "Insurer se surrender quote lijiye aur daaliye.", "बीमा कंपनी से सरेंडर कोट लीजिए और डालिए।"],
    ["Record whether there is a loan on the policy.", "Policy par loan hai ya nahi, record kijiye.", "पॉलिसी पर लोन है या नहीं, रिकॉर्ड कीजिए।"],
    ["Nothing to do.", "Kuch karna nahi hai.", "कुछ करना नहीं है।"],
    ["Possible duplicate upload. Review both copies.", "Shayad do baar upload hui hai. Dono copy dekhiye.", "शायद दो बार अपलोड हुई है। दोनों कॉपी देखिए।"],
    ["Check with the insurer that the quote is still current.", "Insurer se pakka kijiye ki quote abhi bhi sahi hai.", "बीमा कंपनी से पक्का कीजिए कि कोट अभी भी सही है।"],
  ] as const).map(([e, h, d]) => L(`   Next: ${e}`, `   Aage: ${h}`, `   आगे: ${d}`)),

  L("Still missing ({n}):", "Abhi baaki ({n}):", "अभी बाकी ({n}):"),
  L("Every document on the checklist is in.", "Checklist ke saare documents aa gaye hain.", "चेकलिस्ट के सारे डॉक्यूमेंट आ गए हैं।"),
  L("Documents are deleted in 1 day.", "Documents 1 din mein delete ho jayenge.", "डॉक्यूमेंट 1 दिन में डिलीट हो जाएँगे।"),
  L("Documents are deleted in {n} days.", "Documents {n} din mein delete ho jayenge.", "डॉक्यूमेंट {n} दिन में डिलीट हो जाएँगे।"),
  L("You can extend this once, by 30 days, in the portal.", "Portal mein ek baar 30 din ke liye badha sakte hain.", "पोर्टल में एक बार 30 दिन के लिए बढ़ा सकते हैं।"),
  L("The documents were deleted on {d}, as planned for closed paperwork.", "Documents {d} ko delete ho gaye, jaisa band claim ke liye tay tha.", "डॉक्यूमेंट {d} को डिलीट हो गए, जैसा बंद क्लेम के लिए तय था।"),

  L("No checked policies yet. Send a policy PDF to start your book.", "Abhi koi checked policy nahi hai. Shuru karne ke liye policy ki PDF bhejiye.", "अभी कोई चेक की हुई पॉलिसी नहीं है। शुरू करने के लिए पॉलिसी की PDF भेजिए।"),
  L("📊 Your book: {x}", "📊 Aapki book: {x}", "📊 आपकी बुक: {x}"),
  L("Renewing in 30 days: {n}", "30 din mein renewal: {n}", "30 दिन में रिन्यूअल: {n}"),
  L("Expired: {n}", "Khatam ho chuki: {n}", "ख़त्म हो चुकी: {n}"),
  L("No expiry date on file: {n}", "Expiry date record mein nahi: {n}", "एक्सपायरी तारीख़ रिकॉर्ड में नहीं: {n}"),
  L("By type: {x}", "Prakar ke hisaab se: {x}", "प्रकार के हिसाब से: {x}"),
  L("Health score average: {x}", "Health score ka average: {x}", "हेल्थ स्कोर का औसत: {x}"),
  L("Renewals ahead: {x}", "Aane wale renewals: {x}", "आने वाले रिन्यूअल: {x}"),

  L("You don't have a page yet. Make one in the portal: {url}", "Aapka page abhi nahi bana. Portal mein banaiye: {url}", "आपका पेज अभी नहीं बना। पोर्टल में बनाइए: {url}"),
  L("🌐 No visits to your page in the last 30 days. Leads from your page so far: {n}.", "🌐 Pichhle 30 din mein aapke page par koi nahi aaya. Page se ab tak leads: {n}.", "🌐 पिछले 30 दिन में आपके पेज पर कोई नहीं आया। पेज से अब तक लीड: {n}।"),
  L("Share it: type LINK", "Share karne ke liye LINK likhiye", "शेयर करने के लिए LINK लिखिए"),
  L("🌐 Your page, last 30 days: {x}", "🌐 Aapka page, pichhle 30 din: {x}", "🌐 आपका पेज, पिछले 30 दिन: {x}"),
  L("Leads from your page so far: {n}", "Page se ab tak leads: {n}", "पेज से अब तक लीड: {n}"),
  L("Came from: {x}", "Kahan se aaye: {x}", "कहाँ से आए: {x}"),
  L("Opened in: {x}", "Kis app mein khola: {x}", "किस ऐप में खोला: {x}"),
  L("Device: {x}", "Device: {x}", "डिवाइस: {x}"),
  L("Something went wrong on my side. Please try again in a minute.", "Hamari taraf se kuch gadbad ho gayi. Ek minute baad dobara try kijiye.", "हमारी तरफ़ से कुछ गड़बड़ हो गई। एक मिनट बाद दोबारा कोशिश कीजिए।"),
  L("Okay, cancelled. Send a PDF or type HELP any time.", "Theek hai, cancel kar diya. Kabhi bhi PDF bhejiye ya HELP likhiye.", "ठीक है, रद्द कर दिया। कभी भी PDF भेजिए या HELP लिखिए।"),
  L("You're connected to IndSure. Send me a customer's health policy PDF and I'll send back the report. You can also type RENEWALS or HELP.",
    "Aap IndSure se jud gaye hain. Customer ki health policy ki PDF bhejiye, report yahin aa jayegi. RENEWALS ya HELP bhi likh sakte hain.",
    "आप IndSure से जुड़ गए हैं। कस्टमर की हेल्थ पॉलिसी की PDF भेजिए, रिपोर्ट यहीं आ जाएगी। RENEWALS या HELP भी लिख सकते हैं।"),
  L("Save the contact below so this chat shows as IndSure AI Assistant, not a number.",
    "Neeche wala contact save kar lijiye, taaki yeh chat number ki jagah IndSure AI Assistant naam se dikhe.",
    "नीचे वाला कॉन्टैक्ट सेव कर लीजिए, ताकि यह चैट नंबर की जगह IndSure AI Assistant नाम से दिखे।"),
  L("Done. This WhatsApp number is no longer connected to your IndSure account.", "Ho gaya. Yeh WhatsApp number ab aapke IndSure account se juda nahi hai.", "हो गया। यह WhatsApp नंबर अब आपके IndSure खाते से जुड़ा नहीं है।"),

  /* Policy PDFs */
  L("Got it. Reading this PDF.", "Mil gaya. PDF padh raha hoon.", "मिल गया। PDF पढ़ रहा हूँ।"),
  L("Checking it now, usually about a minute.", "Check ho rahi hai, aam taur par ek minute lagta hai.", "चेक हो रही है, आमतौर पर एक मिनट लगता है।"),

  /* Base policy + super top-up (templates.ts topUpAsk ... heldDropped) */
  L("Does this customer also have a super top-up policy? Send that PDF now and I'll check both together for 1 policy check.",
    "Kya is customer ki super top-up policy bhi hai? Woh PDF abhi bhejiye, dono ek saath check karunga, sirf 1 policy check lagega.",
    "क्या इस ग्राहक की सुपर टॉप-अप पॉलिसी भी है? वह PDF अभी भेजिए, दोनों एक साथ चेक करूँगा, सिर्फ़ 1 पॉलिसी चेक लगेगा।"),
  L("Does {p} also have a super top-up policy? Send that PDF now and I'll check both together for 1 policy check.",
    "Kya {p} ki super top-up policy bhi hai? Woh PDF abhi bhejiye, dono ek saath check karunga, sirf 1 policy check lagega.",
    "क्या {p} की सुपर टॉप-अप पॉलिसी भी है? वह PDF अभी भेजिए, दोनों एक साथ चेक करूँगा, सिर्फ़ 1 पॉलिसी चेक लगेगा।"),
  L("Or reply NO to check this one alone.", "Ya sirf isko check karne ke liye NO likhiye.", "या सिर्फ़ इसे चेक करने के लिए NO लिखिए।"),
  L("This looks like a super top-up.", "Yeh super top-up policy lag rahi hai.", "यह सुपर टॉप-अप पॉलिसी लग रही है।"),
  L("This looks like a super top-up for {p}.", "Yeh {p} ki super top-up policy lag rahi hai.", "यह {p} की सुपर टॉप-अप पॉलिसी लग रही है।"),
  L("Send the base health policy too and I'll check both together for 1 policy check.",
    "Base health policy bhi bhejiye, dono ek saath check karunga, sirf 1 policy check lagega.",
    "बेस हेल्थ पॉलिसी भी भेजिए, दोनों एक साथ चेक करूँगा, सिर्फ़ 1 पॉलिसी चेक लगेगा।"),
  L("Or reply ALONE to check the top-up by itself.", "Ya sirf top-up check karne ke liye ALONE likhiye.", "या सिर्फ़ टॉप-अप चेक करने के लिए ALONE लिखिए।"),
  L("Okay, send the super top-up PDF now. Or reply NO to check this one alone.",
    "Theek hai, super top-up ki PDF abhi bhejiye. Ya sirf isko check karne ke liye NO likhiye.",
    "ठीक है, सुपर टॉप-अप की PDF अभी भेजिए। या सिर्फ़ इसे चेक करने के लिए NO लिखिए।"),
  L("Okay, send the base health policy PDF now. Or reply ALONE to check the top-up by itself.",
    "Theek hai, base health policy ki PDF abhi bhejiye. Ya sirf top-up check karne ke liye ALONE likhiye.",
    "ठीक है, बेस हेल्थ पॉलिसी की PDF अभी भेजिए। या सिर्फ़ टॉप-अप चेक करने के लिए ALONE लिखिए।"),
  L("Is this the super top-up for the first policy?", "Kya yeh pehli policy ka super top-up hai?", "क्या यह पहली पॉलिसी का सुपर टॉप-अप है?"),
  L("Is this the super top-up for {p}?", "Kya yeh {p} ka super top-up hai?", "क्या यह {p} का सुपर टॉप-अप है?"),
  L("These may be different people: the base policy names {a}, the super top-up names {b}.",
    "Yeh alag log ho sakte hain: base policy mein naam {a} hai, super top-up mein {b}.",
    "ये अलग लोग हो सकते हैं: बेस पॉलिसी में नाम {a} है, सुपर टॉप-अप में {b}।"),
  L("The base policy names {a}, the super top-up names {b}.",
    "Base policy mein naam {a} hai, super top-up mein {b}.",
    "बेस पॉलिसी में नाम {a} है, सुपर टॉप-अप में {b}।"),
  L("I couldn't read the names on both, so I can't confirm it's the same person.",
    "Dono par naam padh nahi paya, isliye pakka nahi keh sakta ki ek hi vyakti hai.",
    "दोनों पर नाम पढ़ नहीं पाया, इसलिए पक्का नहीं कह सकता कि एक ही व्यक्ति है।"),
  ...CHECKS("Reply YES to check them together as one cover (1 policy check), or NO to check them separately ({c}).",
    "Dono ek saath check karne ke liye YES likhiye (1 policy check), ya alag alag check karne ke liye NO ({c}).",
    "दोनों एक साथ चेक करने के लिए YES लिखिए (1 पॉलिसी चेक), या अलग-अलग चेक करने के लिए NO ({c})।"),
  L("You've sent {n} health policies:", "Aapne {n} health policies bheji hain:", "आपने {n} हेल्थ पॉलिसी भेजी हैं:"),
  L("To check a base policy with its super top-up, reply with both numbers, base first, like 1+2.",
    "Base policy ko uske super top-up ke saath check karne ke liye dono number likhiye, pehle base, jaise 1+2.",
    "बेस पॉलिसी को उसके सुपर टॉप-अप के साथ चेक करने के लिए दोनों नंबर लिखिए, पहले बेस, जैसे 1+2।"),
  ...CHECKS("Or reply NO to check each one separately ({c}).",
    "Ya har ek alag check karne ke liye NO likhiye ({c}).",
    "या हर एक अलग चेक करने के लिए NO लिखिए ({c})।"),
  L("The super top-up is a scanned copy, and a scanned top-up can't be read together with a base policy.",
    "Super top-up scan ki hui copy hai, aur scan copy base policy ke saath padhi nahi ja sakti.",
    "सुपर टॉप-अप स्कैन की हुई कॉपी है, और स्कैन कॉपी बेस पॉलिसी के साथ पढ़ी नहीं जा सकती।"),
  ...CHECKS("Reply NO to check them separately ({c}), or send the insurer's original PDF of the top-up.",
    "Alag alag check karne ke liye NO likhiye ({c}), ya top-up ki insurer wali original PDF bhejiye.",
    "अलग-अलग चेक करने के लिए NO लिखिए ({c}), या टॉप-अप की इंश्योरर वाली ओरिजिनल PDF भेजिए।"),
  L("Okay, checking them together as one cover. It uses 1 policy check.",
    "Theek hai, dono ek saath ek cover ki tarah check ho rahe hain. Isme 1 policy check lagega.",
    "ठीक है, दोनों एक साथ एक कवर की तरह चेक हो रहे हैं। इसमें 1 पॉलिसी चेक लगेगा।"),
  L("The other policy will be checked separately.", "Doosri policy alag se check hogi.", "दूसरी पॉलिसी अलग से चेक होगी।"),
  L("The other {n} policies will be checked separately.", "Baaki {n} policies alag se check hongi.", "बाकी {n} पॉलिसी अलग से चेक होंगी।"),
  L("{x} was already checked, so I didn't check it again: {url}", "{x} pehle check ho chuki hai, isliye dobara check nahi ki: {url}", "{x} पहले चेक हो चुकी है, इसलिए दोबारा चेक नहीं की: {url}"),
  L("I can't tell what kind of policy this PDF is. Please answer about {x} first, then send this one again. No policy check was used.",
    "Samajh nahi aaya yeh kaunsi policy hai. Pehle {x} wale sawaal ka jawab dijiye, phir yeh PDF dobara bhejiye. Koi policy check use nahi hua.",
    "समझ नहीं आया यह कौन सी पॉलिसी है। पहले {x} वाले सवाल का जवाब दीजिए, फिर यह PDF दोबारा भेजिए। कोई पॉलिसी चेक इस्तेमाल नहीं हुआ।"),
  L("I didn't hear back about {x}, so I didn't check it and no policy check was used. Send it again when you're ready.",
    "{x} ke baare mein jawab nahi aaya, isliye check nahi ki aur koi policy check use nahi hua. Jab chahein dobara bhejiye.",
    "{x} के बारे में जवाब नहीं आया, इसलिए चेक नहीं की और कोई पॉलिसी चेक इस्तेमाल नहीं हुआ। जब चाहें दोबारा भेजिए।"),
  L("I've set aside {x} without checking it. No policy check was used. Send it again when you're ready.",
    "{x} ko bina check kiye rakh diya hai. Koi policy check use nahi hua. Jab chahein dobara bhejiye.",
    "{x} को बिना चेक किए रख दिया है। कोई पॉलिसी चेक इस्तेमाल नहीं हुआ। जब चाहें दोबारा भेजिए।"),
  L("Checked together with the super top-up. Total cover is in the full report.",
    "Super top-up ke saath ek saath check hui. Kul cover poori report mein hai.",
    "सुपर टॉप-अप के साथ एक साथ चेक हुई। कुल कवर पूरी रिपोर्ट में है।"),
  L("I couldn't read the super top-up, so this report is for the base policy only.",
    "Super top-up padh nahi paya, isliye yeh report sirf base policy ki hai.",
    "सुपर टॉप-अप पढ़ नहीं पाया, इसलिए यह रिपोर्ट सिर्फ़ बेस पॉलिसी की है।"),
  L("I no longer have those files. Please send the base policy and the super top-up again.",
    "Woh files ab nahi hain. Base policy aur super top-up dobara bhejiye.",
    "वे फ़ाइलें अब नहीं हैं। बेस पॉलिसी और सुपर टॉप-अप दोबारा भेजिए।"),
  L("Got it. This one is in line behind {n} other {x}. I'll send each report as it's ready.", "Mil gaya. Isse pehle {n} aur policy line mein hain. Har report taiyaar hote hi aa jayegi.", "मिल गया। इससे पहले {n} और पॉलिसी लाइन में हैं। हर रिपोर्ट तैयार होते ही आ जाएगी।"),
  L("Still reading this one. Longer policies take a bit more time.", "Abhi padh rahe hain. Lambi policy mein thoda zyada time lagta hai.", "अभी पढ़ रहे हैं। लंबी पॉलिसी में थोड़ा ज़्यादा समय लगता है।"),
  L("This is taking longer than usual. I'll message you when it's ready. You can also check it in the portal: {url}",
    "Is baar zyada time lag raha hai. Taiyaar hote hi message aa jayega. Portal mein bhi dekh sakte hain: {url}",
    "इस बार ज़्यादा समय लग रहा है। तैयार होते ही मैसेज आ जाएगा। पोर्टल में भी देख सकते हैं: {url}"),
  L("I'm still checking a policy. I'll send the report as soon as it's ready.", "Ek policy abhi check ho rahi hai. Report taiyaar hote hi aa jayegi.", "एक पॉलिसी अभी चेक हो रही है। रिपोर्ट तैयार होते ही आ जाएगी।"),
  L("I can only read PDF files. Could you send the insurer's original PDF?", "Sirf PDF file padh sakte hain. Insurer ki original PDF bhej dijiye.", "सिर्फ़ PDF फ़ाइल पढ़ सकते हैं। बीमा कंपनी की ओरिजिनल PDF भेज दीजिए।"),
  L("This file is over 25MB, which is too big to read. The insurer's original PDF is usually much smaller.",
    "Yeh file 25MB se badi hai, padhi nahi ja sakti. Insurer ki original PDF aam taur par kaafi chhoti hoti hai.",
    "यह फ़ाइल 25MB से बड़ी है, पढ़ी नहीं जा सकती। बीमा कंपनी की ओरिजिनल PDF आमतौर पर काफ़ी छोटी होती है।"),
  L("I couldn't open this PDF. Please send the insurer's original PDF. No policy check was used.",
    "Yeh PDF khul nahi payi. Insurer ki original PDF bhejiye. Koi policy check use nahi hua.",
    "यह PDF खुल नहीं पाई। बीमा कंपनी की ओरिजिनल PDF भेजिए। कोई पॉलिसी चेक इस्तेमाल नहीं हुआ।"),
  L("I couldn't read this policy: the PDF is password-protected. Remove the password and send it again. No policy check was used.",
    "Is PDF par password laga hai. Password hata kar dobara bhejiye. Koi policy check use nahi hua.",
    "इस PDF पर पासवर्ड लगा है। पासवर्ड हटाकर दोबारा भेजिए। कोई पॉलिसी चेक इस्तेमाल नहीं हुआ।"),
  L("I couldn't read this policy: {reason}. {fix}. It's waiting in Needs Attention in the portal.",
    "Yeh policy padhi nahi ja saki ({reason}). {fix}. Yeh portal mein Needs Attention mein rakhi hai.",
    "यह पॉलिसी पढ़ी नहीं जा सकी ({reason})। {fix}। यह पोर्टल में Needs Attention में रखी है।"),
  L("This policy is written in Hindi. I can only read English policies for now, so no policy check was used.",
    "Yeh policy Hindi mein likhi hai. Abhi sirf English policies padh sakte hain, koi policy check use nahi hua.",
    "यह पॉलिसी हिंदी में लिखी है। अभी सिर्फ़ अंग्रेज़ी पॉलिसी पढ़ सकते हैं, कोई पॉलिसी चेक इस्तेमाल नहीं हुआ।"),
  L("What kind of policy is this? Reply with a number:", "Yeh kaunsi policy hai? Number likhiye:", "यह कौन सी पॉलिसी है? नंबर लिखिए:"),
  L("You've already checked this exact file. Here's the report: {url}", "Yeh file pehle check ho chuki hai. Report: {url}", "यह फ़ाइल पहले चेक हो चुकी है। रिपोर्ट: {url}"),
  L("Run a fresh check? It uses 1 policy check. Reply YES or NO.", "Dobara check karein? Isme 1 policy check lagega. YES ya NO likhiye.", "दोबारा चेक करें? इसमें 1 पॉलिसी चेक लगेगा। YES या NO लिखिए।"),
  L("Reply YES to run a fresh check (it uses 1 policy check), or NO to keep the existing report.",
    "Naye check ke liye YES likhiye (1 policy check lagega), ya purani report rakhne ke liye NO.",
    "नए चेक के लिए YES लिखिए (1 पॉलिसी चेक लगेगा), या पुरानी रिपोर्ट रखने के लिए NO।"),
  L("Okay, no new check. Ask me anything about it, or reply SHARE.", "Theek hai, naya check nahi. Is policy ke baare mein kuch bhi poochiye, ya SHARE likhiye.", "ठीक है, नया चेक नहीं। इस पॉलिसी के बारे में कुछ भी पूछिए, या SHARE लिखिए।"),
  L("Whose policy is this? Reply with the customer's name or phone number, or SKIP to leave it unassigned.",
    "Yeh kiski policy hai? Customer ka naam ya phone number likhiye, ya SKIP.",
    "यह किसकी पॉलिसी है? कस्टमर का नाम या फ़ोन नंबर लिखिए, या SKIP।"),
  L("I found more than one customer. Which one?", "Ek se zyada customer mile. Kaunsa?", "एक से ज़्यादा कस्टमर मिले। कौन सा?"),
  L("Reply with the number, or SKIP.", "Number likhiye, ya SKIP.", "नंबर लिखिए, या SKIP।"),
  L("Saved under {name}.", "{name} ke naam par save ho gaya.", "{name} के नाम पर सेव हो गया।"),
  L("I couldn't find a customer called \"{q}\" in your book, so the policy is saved as unassigned. You can file it in the portal.",
    "\"{q}\" naam ka customer nahi mila, isliye policy bina naam ke save hui hai. Portal mein customer ke saath jod sakte hain.",
    "\"{q}\" नाम का कस्टमर नहीं मिला, इसलिए पॉलिसी बिना नाम के सेव हुई है। पोर्टल में कस्टमर के साथ जोड़ सकते हैं।"),
  L("Okay, left unassigned. You can file it under a customer in the portal.", "Theek hai, bina customer ke rakha hai. Portal mein customer ke saath jod sakte hain.", "ठीक है, बिना कस्टमर के रखा है। पोर्टल में कस्टमर के साथ जोड़ सकते हैं।"),
  L("Which customer's policy? Reply with their name, or send me the policy PDF.", "Kis customer ki policy? Naam likhiye, ya policy ki PDF bhejiye.", "किस कस्टमर की पॉलिसी? नाम लिखिए, या पॉलिसी की PDF भेजिए।"),
  L("I found a few. Which one?", "Kuch mile hain. Kaunsa?", "कुछ मिले हैं। कौन सा?"),
  L("Reply with the number.", "Number likhiye.", "नंबर लिखिए।"),
  L("I couldn't find a checked policy for \"{q}\". Send me the PDF and I'll check it.", "\"{q}\" ki koi checked policy nahi mili. PDF bhejiye, check ho jayegi.", "\"{q}\" की कोई चेक की हुई पॉलिसी नहीं मिली। PDF भेजिए, चेक हो जाएगी।"),
  L("Which language for the message?", "Message kis bhasha mein?", "मैसेज किस भाषा में?"),
  L("You've used all your policy checks for now. Message the IndSure team to get more: {url}", "Aapke saare policy checks khatam ho gaye hain. Aur ke liye IndSure team ko message kijiye: {url}", "आपके सारे पॉलिसी चेक ख़त्म हो गए हैं। और के लिए IndSure टीम को मैसेज कीजिए: {url}"),
  L("You've used all your data entry for now, so I couldn't save this policy. Message the IndSure team to get more: {url}",
    "Aapki data entry khatam ho gayi hai, isliye yeh policy save nahi hui. Aur ke liye IndSure team ko message kijiye: {url}",
    "आपकी डेटा एंट्री ख़त्म हो गई है, इसलिए यह पॉलिसी सेव नहीं हुई। और के लिए IndSure टीम को मैसेज कीजिए: {url}"),
  L("I couldn't get a result for this policy. Please check it in the portal: {url}", "Is policy ka result nahi mil paya. Portal mein dekh lijiye: {url}", "इस पॉलिसी का रिज़ल्ट नहीं मिल पाया। पोर्टल में देख लीजिए: {url}"),
  L("I no longer have that file. Please send the PDF again.", "Woh file ab nahi hai. PDF dobara bhejiye.", "वह फ़ाइल अब नहीं है। PDF दोबारा भेजिए।"),
  L("Saved {x} to your book. Scores are for health policies only right now, so this one has its key details filled in, no score. This used data entry, not a policy check.",
    "{x} aapki book mein save ho gayi. Score abhi sirf health policy ka milta hai, isliye isme zaroori details bhari gayi hain. Isme data entry lagi, policy check nahi.",
    "{x} आपकी बुक में सेव हो गई। स्कोर अभी सिर्फ़ हेल्थ पॉलिसी का मिलता है, इसलिए इसमें ज़रूरी जानकारी भरी गई है। इसमें डेटा एंट्री लगी, पॉलिसी चेक नहीं।"),
  L("The report doesn't cover that. Here it is in full: {url}. For exact coverage questions, it's best to check with the insurer.",
    "Report mein iski jaankari nahi hai. Exact coverage ke liye insurer se confirm kar lijiye. Poori report: {url}",
    "रिपोर्ट में इसकी जानकारी नहीं है। सही कवरेज के लिए बीमा कंपनी से पक्का कर लीजिए। पूरी रिपोर्ट: {url}"),

  /* Policy basics (the Policies list) */
  L("Insurer: {x}", "Insurance company: {x}", "बीमा कंपनी: {x}"),
  L("Plan: {x}", "Plan: {x}", "प्लान: {x}"),
  L("Next premium date: {x}", "Agla premium: {x}", "अगला प्रीमियम: {x}"),
  L("Score: {s}/100 · Keep", "Score: {s}/100 · Rakhiye (Keep)", "स्कोर: {s}/100 · रखिए (Keep)"),
  L("Score: {s}/100 · Switch", "Score: {s}/100 · Badliye (Switch)", "स्कोर: {s}/100 · बदलिए (Switch)"),
  L("Sum insured: {x}", "Sum insured: {x}", "बीमा राशि: {x}"),
  L("Premium: {x}", "Premium: {x}", "प्रीमियम: {x}"),
  L("The policy has no renewal date recorded. Add it on the policy in the portal.", "Is policy ki renewal date save nahi hai. Portal mein policy par daal dijiye.", "इस पॉलिसी की रिन्यूअल तारीख़ सेव नहीं है। पोर्टल में पॉलिसी पर डाल दीजिए।"),
  L("Keep. It scores {s}/100, so it should hold up at claim time.", "Rakhiye. Iska score {s}/100 hai, claim ke waqt kaam aayegi.", "रखिए। इसका स्कोर {s}/100 है, क्लेम के समय काम आएगी।"),
  L("Switch. It scores {s}/100, under 70, so it has gaps worth fixing. Reply UPGRADE MESSAGE for a ready message.", "Badliye. Iska score {s}/100 hai, 70 se kam, kuch kamiyan hain. Taiyaar message ke liye UPGRADE MESSAGE likhiye.", "बदलिए। इसका स्कोर {s}/100 है, 70 से कम, कुछ कमियाँ हैं। तैयार मैसेज के लिए UPGRADE MESSAGE लिखिए।"),

  /* Report card and sharing */
  L("Watch out for: {x}.", "Dhyaan dein: {x}.", "ध्यान दें: {x}।"),
  L("Full report: {url}", "Poori report: {url}", "पूरी रिपोर्ट: {url}"),
  L("Reply SHARE to send it to the customer, or ask me anything about it.", "Customer ko bhejne ke liye SHARE likhiye, ya is policy ke baare mein kuch bhi poochiye.", "कस्टमर को भेजने के लिए SHARE लिखिए, या इस पॉलिसी के बारे में कुछ भी पूछिए।"),
  L("Reply SHARE to send it to {n}, or ask me anything about it.", "{n} ko bhejne ke liye SHARE likhiye, ya is policy ke baare mein kuch bhi poochiye.", "{n} को भेजने के लिए SHARE लिखिए, या इस पॉलिसी के बारे में कुछ भी पूछिए।"),
  L("Reply SHARE to send it to the customer.", "Customer ko bhejne ke liye SHARE likhiye.", "कस्टमर को भेजने के लिए SHARE लिखिए।"),
  L("Reply SHARE to send it to {n}.", "{n} ko bhejne ke liye SHARE likhiye.", "{n} को भेजने के लिए SHARE लिखिए।"),
  L("Here's a message for your customer. Tap the link to open it in WhatsApp, check it, and press send:",
    "Customer ke liye message taiyaar hai. Link dabaiye, WhatsApp mein khulega, dekh kar send kijiye:",
    "कस्टमर के लिए मैसेज तैयार है। लिंक दबाइए, WhatsApp में खुलेगा, देखकर भेज दीजिए:"),
  L("Here's a message for {x}. Tap the link to open it in WhatsApp, check it, and press send:",
    "{x} ke liye message taiyaar hai. Link dabaiye, WhatsApp mein khulega, dekh kar send kijiye:",
    "{x} के लिए मैसेज तैयार है। लिंक दबाइए, WhatsApp में खुलेगा, देखकर भेज दीजिए:"),
  L("(I don't have their number, so WhatsApp will ask you to pick the chat.)", "(Unka number nahi hai, isliye WhatsApp chat chunne ko kahega.)", "(उनका नंबर नहीं है, इसलिए WhatsApp चैट चुनने को कहेगा।)"),
  L("The message:", "Message:", "मैसेज:"),
  L("You'll see in the portal when they open the report.", "Jab woh report kholenge, portal mein dikh jayega.", "जब वे रिपोर्ट खोलेंगे, पोर्टल में दिख जाएगा।"),

  /* Renewals, follow-ups, leads */
  L("🔄 Nothing due. No lead renewals this week, and none of your customers' policies expire in the next 30 days.",
    "🔄 Kuch due nahi. Is hafte koi lead renewal nahi, aur agle 30 din mein kisi customer ki policy expire nahi ho rahi.",
    "🔄 कुछ बाकी नहीं। इस हफ़्ते कोई लीड रिन्यूअल नहीं, और अगले 30 दिन में किसी कस्टमर की पॉलिसी ख़त्म नहीं हो रही।"),
  L("🔄 {n} {x} to handle, soonest first:", "🔄 {n} renewal baaki, sabse pehle wale upar:", "🔄 {n} रिन्यूअल बाकी, सबसे पहले वाले ऊपर:"),
  L("Leads, overdue:", "Leads, date nikal gayi:", "लीड, तारीख़ निकल गई:"),
  L("Leads, due this week:", "Leads, is hafte:", "लीड, इस हफ़्ते:"),
  L("Your customers, expiring in 30 days:", "Aapke customers, 30 din mein expire:", "आपके कस्टमर, 30 दिन में ख़त्म:"),
  L("…and {n} more: {url}", "…{n} aur: {url}", "…{n} और: {url}"),
  L("Reply REMIND and a name for a ready-to-send reminder, for example: REMIND Ramesh", "Taiyaar reminder ke liye REMIND aur naam likhiye, jaise: REMIND Ramesh", "तैयार रिमाइंडर के लिए REMIND और नाम लिखिए, जैसे: REMIND Ramesh"),
  L("Who should I remind? For example: REMIND Ramesh", "Kisko reminder bhejna hai? Jaise: REMIND Ramesh", "किसे रिमाइंडर भेजना है? जैसे: REMIND Ramesh"),
  L("I couldn't find \"{n}\" in your renewals list. Type RENEWALS to see who's due.", "\"{n}\" renewal list mein nahi mila. RENEWALS likh kar dekhiye kiska due hai.", "\"{n}\" रिन्यूअल लिस्ट में नहीं मिला। RENEWALS लिखकर देखिए किसका बाकी है।"),
  L("No follow-ups due today. Set one with: follow up Ramesh Friday", "Aaj koi follow-up nahi. Aise set kijiye: Ramesh ko Friday follow up", "आज कोई फॉलो-अप नहीं। ऐसे सेट कीजिए: रमेश को शुक्रवार फॉलो अप"),
  L("📋 {n} follow-up due:", "📋 {n} follow-up baaki:", "📋 {n} फॉलो-अप बाकी:"),
  L("📋 {n} follow-ups due:", "📋 {n} follow-up baaki:", "📋 {n} फॉलो-अप बाकी:"),
  L("Done with one? Reply for example: {n} contacted", "Kisi se baat ho gayi? Aise likhiye: {n} se baat ho gayi", "किसी से बात हो गई? ऐसे लिखिए: {n} contacted"),
  L("You have no leads yet. Add one with: lead Ramesh 98123 45678 health", "Abhi koi lead nahi hai. Aise jodiye: lead Ramesh 98123 45678 health", "अभी कोई लीड नहीं है। ऐसे जोड़िए: lead Ramesh 98123 45678 health"),
  L("📋 Your leads ({n}), latest first:", "📋 Aapki leads ({n}), nayi pehle:", "📋 आपकी लीड ({n}), नई पहले:"),
  L("Update one, for example: {n} interested", "Kisi ko update kijiye, jaise: {n} interested", "किसी को अपडेट कीजिए, जैसे: {n} interested"),
  L("Adding a lead. What's their name?", "Nayi lead. Naam kya hai?", "नई लीड। नाम क्या है?"),
  L("Their phone number? Or SKIP.", "Phone number? Ya SKIP.", "फ़ोन नंबर? या SKIP।"),
  L("What are they interested in? Reply with a number, or SKIP:", "Kis cheez mein interest hai? Number likhiye, ya SKIP:", "किसमें रुचि है? नंबर लिखिए, या SKIP:"),
  L("That doesn't look like a 10-digit mobile number. Send it again, or SKIP.", "Yeh 10 digit ka mobile number nahi lagta. Dobara bhejiye, ya SKIP.", "यह 10 अंकों का मोबाइल नंबर नहीं लगता। दोबारा भेजिए, या SKIP।"),
  L("Saved lead {x}.", "Lead save ho gayi: {x}.", "लीड सेव हो गई: {x}।"),
  L("{n} is already in your leads with this number, so I didn't add it again.", "{n} is number ke saath pehle se aapki leads mein hai, dobara nahi joda.", "{n} इस नंबर के साथ पहले से आपकी लीड में है, दोबारा नहीं जोड़ा।"),
  L("{n} is already in your leads.", "{n} pehle se aapki leads mein hai.", "{n} पहले से आपकी लीड में है।"),
  L("I couldn't find a lead called \"{n}\". Add them with: lead {rest}", "\"{n}\" naam ki lead nahi mili. Aise jodiye: lead {rest}", "\"{n}\" नाम की लीड नहीं मिली। ऐसे जोड़िए: lead {rest}"),
  L("Which lead? For example: Ramesh won, or follow up Ramesh Friday.", "Kaunsi lead? Jaise: Ramesh ne policy le li, ya Ramesh ko Friday follow up.", "कौन सी लीड? जैसे: रमेश ने पॉलिसी ले ली, या रमेश को शुक्रवार फॉलो अप।"),

  /* Confirm and undo */
  L("Please confirm:", "Pakka kijiye:", "पक्का कीजिए:"),
  L("Reply YES to save, or NO.", "Save karne ke liye YES ya haan likhiye, warna NO.", "सेव करने के लिए YES या हाँ लिखिए, नहीं तो NO।"),
  L("Okay, nothing changed.", "Theek hai, kuch nahi badla.", "ठीक है, कुछ नहीं बदला।"),
  L("(That change was not saved.)", "(Woh badlav save nahi hua.)", "(वह बदलाव सेव नहीं हुआ।)"),
  L("(Wrong? Reply UNDO within 15 minutes.)", "(Galat hai? 15 minute ke andar UNDO likhiye.)", "(ग़लत है? 15 मिनट के अंदर UNDO लिखिए।)"),
  L("There's nothing recent to undo. I can undo a change for 15 minutes after it's saved.", "Undo karne ke liye kuch naya nahi hai. Badlav save hone ke 15 minute tak undo ho sakta hai.", "अनडू करने के लिए कुछ नया नहीं है। बदलाव सेव होने के 15 मिनट तक अनडू हो सकता है।"),
  L("That change is too old to undo here. Please fix it in the portal.", "Yeh badlav purana ho gaya, yahan undo nahi ho sakta. Portal mein theek kijiye.", "यह बदलाव पुराना हो गया, यहाँ अनडू नहीं हो सकता। पोर्टल में ठीक कीजिए।"),
  L("• Undo: remove the lead {n} you just added", "• Undo: abhi jodi lead {n} hatayein", "• अनडू: अभी जोड़ी लीड {n} हटाएँ"),
  L("• Undo: put {n} back as it was", "• Undo: {n} ko pehle jaisa karein", "• अनडू: {n} को पहले जैसा करें"),
  L("Undone: removed the lead {n}.", "Undo ho gaya: lead {n} hata di.", "अनडू हो गया: लीड {n} हटा दी।"),
  L("Undone: {n} is back as it was.", "Undo ho gaya: {n} pehle jaisa hai.", "अनडू हो गया: {n} पहले जैसा है।"),

  /* Checks, balance, Sach Assistant, morning brief */
  L("You have {n} policy check left.", "Aapke paas {n} policy check bacha hai.", "आपके पास {n} पॉलिसी चेक बचा है।"),
  L("You have {n} policy checks left.", "Aapke paas {n} policy checks bache hain.", "आपके पास {n} पॉलिसी चेक बचे हैं।"),
  L("Next: send a health policy PDF to use one.", "Aage: health policy ki PDF bhejiye.", "आगे: हेल्थ पॉलिसी की PDF भेजिए।"),
  L("To get more: {url}", "Aur ke liye: {url}", "और के लिए: {url}"),
  L("*Policy checks left:* {n}", "*Bache policy checks:* {n}", "*बचे पॉलिसी चेक:* {n}"),
  L("*Sach Assistant:* {u} of {l} replies used this month. Resets on {d}.", "*Sach Assistant:* is mahine {l} mein se {u} jawab use hue. {d} ko phir se shuru.", "*Sach Assistant:* इस महीने {l} में से {u} जवाब इस्तेमाल हुए। {d} को फिर से शुरू।"),
  L("Short commands like RENEWALS, HELP and YES never count.", "RENEWALS, HELP, YES jaise chhote commands gine nahi jaate.", "RENEWALS, HELP, YES जैसे छोटे कमांड गिने नहीं जाते।"),
  L("Sach Assistant (type it your way, plus a 9 AM to-do Monday to Friday) comes with the paid plan: {url}",
    "Sach Assistant (apne tareeke se likhiye, aur Somvar se Shukravar subah 9 baje aaj ka kaam) paid plan ke saath milta hai: {url}",
    "Sach Assistant (अपने तरीके से लिखिए, और सोमवार से शुक्रवार सुबह 9 बजे आज का काम) पेड प्लान के साथ मिलता है: {url}"),
  L("With Sach Assistant (paid plan) you can just type it your way, in English, Hinglish or Hindi: {url}",
    "Sach Assistant (paid plan) ke saath aap apne tareeke se likh sakte hain, English, Hinglish ya Hindi mein: {url}",
    "Sach Assistant (पेड प्लान) के साथ आप अपने तरीके से लिख सकते हैं, अंग्रेज़ी, हिंग्लिश या हिंदी में: {url}"),
  L("Heads up: you've used {u} of {l} Sach Assistant replies this month. They reset on {d}.", "Dhyaan dein: is mahine {l} mein se {u} Sach Assistant jawab use ho gaye. {d} ko phir se shuru honge.", "ध्यान दें: इस महीने {l} में से {u} Sach Assistant जवाब इस्तेमाल हो गए। {d} को फिर से शुरू होंगे।"),
  L("You've used all {l} Sach Assistant replies this month. Until {d} I'll work on short commands (reply HELP to see them).",
    "Is mahine ke saare {l} Sach Assistant jawab use ho gaye. {d} tak chhote commands chalenge (dekhne ke liye HELP likhiye).",
    "इस महीने के सारे {l} Sach Assistant जवाब इस्तेमाल हो गए। {d} तक छोटे कमांड चलेंगे (देखने के लिए HELP लिखिए)।"),
  L("☀️ Good morning {n}. Here's your to-do:", "☀️ Good morning {n}. Aaj ka kaam:", "☀️ सुप्रभात {n}। आज का काम:"),
  L("☀️ Good morning. Here's your to-do:", "☀️ Good morning. Aaj ka kaam:", "☀️ सुप्रभात। आज का काम:"),
  L("*Follow-ups today:* {x}", "*Aaj ke follow-up:* {x}", "*आज के फॉलो-अप:* {x}"),
  L("*Overdue follow-ups:* {x}", "*Chhoote hue follow-up:* {x}", "*छूटे हुए फॉलो-अप:* {x}"),
  L("*Renewals this week:* {x}", "*Is hafte renewal:* {x}", "*इस हफ़्ते रिन्यूअल:* {x}"),
  L("*Opened their report:* {x}", "*Report kholi:* {x}", "*रिपोर्ट खोली:* {x}"),
  L("*Open claims:* {x}", "*Chalu claims:* {x}", "*चालू क्लेम:* {x}"),
  L("Reply {x} for the full list.", "Poori list ke liye {x} likhiye.", "पूरी लिस्ट के लिए {x} लिखिए।"),
  L("☀️ Nothing on your list right now: no follow-ups, renewals this week or open claims.", "☀️ Abhi list khaali hai: koi follow-up, is hafte renewal ya chalu claim nahi.", "☀️ अभी लिस्ट ख़ाली है: कोई फॉलो-अप, इस हफ़्ते रिन्यूअल या चालू क्लेम नहीं।"),
  L("Okay, no more morning briefs. Send MORNING ON to start them again.", "Theek hai, subah ka message band. Phir se shuru karne ke liye MORNING ON.", "ठीक है, सुबह का मैसेज बंद। फिर से शुरू करने के लिए MORNING ON।"),
  L("Done. You'll get your to-do at 9 AM, Monday to Friday. Send MORNING OFF to stop.", "Ho gaya. Somvar se Shukravar subah 9 baje aaj ka kaam aayega. Band karne ke liye MORNING OFF.", "हो गया। सोमवार से शुक्रवार सुबह 9 बजे आज का काम आएगा। बंद करने के लिए MORNING OFF।"),
  L("The 9 AM morning brief is part of Sach Assistant, which comes with the paid plan: {url}", "Subah 9 baje ka message Sach Assistant ka hissa hai, jo paid plan ke saath milta hai: {url}", "सुबह 9 बजे का मैसेज Sach Assistant का हिस्सा है, जो पेड प्लान के साथ मिलता है: {url}"),

  /* Calculator */
  L("Cover calculator for {n}.", "{n} ke liye cover calculator.", "{n} के लिए कवर कैलकुलेटर।"),
  L("Cover calculator.", "Cover calculator.", "कवर कैलकुलेटर।"),
  L("Which city do they live in? (Or say metro, tier 1 or tier 2.)", "Woh kis shehar mein rehte hain? (Ya metro, tier 1, tier 2 likhiye.)", "वे किस शहर में रहते हैं? (या metro, tier 1, tier 2 लिखिए।)"),
  L("Do they travel outside India?", "Kya woh videsh jaate hain?", "क्या वे विदेश जाते हैं?"),
  L("1) Rarely or never", "1) Kabhi kabhaar ya kabhi nahi", "1) कभी-कभार या कभी नहीं"),
  L("2) Yes, holidays or work trips abroad", "2) Haan, chhutti ya kaam se videsh", "2) हाँ, छुट्टी या काम से विदेश"),
  L("Who needs to be covered?", "Kiska cover chahiye?", "किसका कवर चाहिए?"),
  L("1) Just them", "1) Sirf unka", "1) सिर्फ़ उनका"),
  L("2) Couple", "2) Pati-patni", "2) पति-पत्नी"),
  L("3) Couple with kids", "3) Pati-patni aur bachche", "3) पति-पत्नी और बच्चे"),
  L("4) Family including parents", "4) Parivaar, maa-baap samet", "4) परिवार, माता-पिता समेत"),
  L("How old are they? (18 to 75)", "Unki umar kitni hai? (18 se 75)", "उनकी उम्र कितनी है? (18 से 75)"),
  L("Their annual income?", "Saal ki income?", "सालाना आमदनी?"),
  L("{n}) Under ₹{x} lakh", "{n}) ₹{x} lakh se kam", "{n}) ₹{x} लाख से कम"),
  L("{n}) Over ₹{x} lakh", "{n}) ₹{x} lakh se zyada", "{n}) ₹{x} लाख से ज़्यादा"),
  L("{n}) ₹{a} to {b} lakh", "{n}) ₹{a} se {b} lakh", "{n}) ₹{a} से {b} लाख"),
  L("Spouse's age? (SKIP if you don't know)", "Pati/patni ki umar? (Pata na ho to SKIP)", "पति/पत्नी की उम्र? (पता न हो तो SKIP)"),
  L("How many children? 1, 2 or 3", "Kitne bachche? 1, 2 ya 3", "कितने बच्चे? 1, 2 या 3"),
  L("Parents' ages, father then mother, for example: 65 and 60. Say 0 for a parent who isn't covered.",
    "Maa-baap ki umar, pehle pita phir maa, jaise: 65 and 60. Jinka cover nahi chahiye unke liye 0.",
    "माता-पिता की उम्र, पहले पिता फिर माँ, जैसे: 65 and 60। जिनका कवर नहीं चाहिए उनके लिए 0।"),
  L("Health cover from their employer?", "Company se health cover?", "कंपनी से हेल्थ कवर?"),
  L("1) None", "1) Nahi", "1) नहीं"),
  L("How much risk are they comfortable with?", "Kitna risk theek hai?", "कितना जोखिम ठीक है?"),
  L("1) Minimum cover, but safe", "1) Kam se kam cover, par surakshit", "1) कम से कम कवर, पर सुरक्षित"),
  L("2) Balanced", "2) Beech ka", "2) बीच का"),
  L("3) No financial shock at all", "3) Koi financial jhatka nahi", "3) कोई आर्थिक झटका नहीं"),
  L("Which hospitals do they prefer?", "Kaunse hospital pasand hain?", "कौन से अस्पताल पसंद हैं?"),
  L("1) Any good hospital", "1) Koi bhi achha hospital", "1) कोई भी अच्छा अस्पताल"),
  L("2) Large private hospitals", "2) Bade private hospital", "2) बड़े प्राइवेट अस्पताल"),
  L("3) Premium corporate hospitals", "3) Premium corporate hospital", "3) प्रीमियम कॉर्पोरेट अस्पताल"),
  L("Any regular medical costs?", "Koi niyamit ilaaj ka kharcha?", "कोई नियमित इलाज का ख़र्च?"),
  L("2) Minor (tests, OPD, medicines)", "2) Chhota (tests, OPD, dawaiyan)", "2) छोटा (टेस्ट, OPD, दवाइयाँ)"),
  L("3) A chronic condition, but stable", "3) Purani bimari, par control mein", "3) पुरानी बीमारी, पर कंट्रोल में"),
  L("Reply 1, 2 or 3.", "1, 2 ya 3 likhiye.", "1, 2 या 3 लिखिए।"),
  L("Reply 1 to 4, or say who: just them, couple, with kids, or with parents.", "1 se 4 tak number likhiye.", "1 से 4 तक नंबर लिखिए।"),
  L("Reply 1 to 4, or the income in lakhs, for example 12 lakh.", "1 se 4 likhiye, ya income lakh mein, jaise 12 lakh.", "1 से 4 लिखिए, या आमदनी लाख में, जैसे 12 lakh।"),
  L("Reply 1 to 4, or an amount like 5 lakh, or NONE.", "1 se 4 likhiye, ya amount jaise 5 lakh, ya NONE.", "1 से 4 लिखिए, या रकम जैसे 5 lakh, या NONE।"),
  L("Reply 1, 2 or 3: minimum, balanced, or no financial shock.", "1, 2 ya 3 likhiye.", "1, 2 या 3 लिखिए।"),
  L("Reply 1 (rarely or never) or 2 (yes, they travel abroad).", "1 (kabhi nahi) ya 2 (haan, videsh jaate hain) likhiye.", "1 (कभी नहीं) या 2 (हाँ, विदेश जाते हैं) लिखिए।"),
  L("The calculator covers ages 18 to 75, as in the portal. Reply with the age, for example 42.", "Calculator 18 se 75 saal ki umar ke liye hai. Umar likhiye, jaise 42.", "कैलकुलेटर 18 से 75 साल की उम्र के लिए है। उम्र लिखिए, जैसे 42।"),
  L("I don't know that city. Type the nearest big city, or reply METRO, TIER 1 or TIER 2.", "Yeh shehar nahi mila. Paas ka bada shehar likhiye, ya METRO, TIER 1, TIER 2.", "यह शहर नहीं मिला। पास का बड़ा शहर लिखिए, या METRO, TIER 1, TIER 2।"),
  L("Reply with the spouse's age, for example 38, or SKIP.", "Pati/patni ki umar likhiye, jaise 38, ya SKIP.", "पति/पत्नी की उम्र लिखिए, जैसे 38, या SKIP।"),
  L("Reply with both ages, father then mother, for example: 65 and 60 (0 for one who isn't covered).", "Dono ki umar likhiye, pehle pita phir maa, jaise: 65 and 60.", "दोनों की उम्र लिखिए, पहले पिता फिर माँ, जैसे: 65 and 60।"),
  L("Those ages look off. Reply father then mother, for example: 65 and 60.", "Yeh umar sahi nahi lag rahi. Pehle pita phir maa, jaise: 65 and 60.", "यह उम्र सही नहीं लग रही। पहले पिता फिर माँ, जैसे: 65 and 60।"),
  L("Please check (for {n}):", "Ek baar dekh lijiye ({n} ke liye):", "एक बार देख लीजिए ({n} के लिए):"),
  L("Please check:", "Ek baar dekh lijiye:", "एक बार देख लीजिए:"),
  L("• City: {x}", "• Shehar: {x}", "• शहर: {x}"),
  L("• Travel abroad: yes", "• Videsh yatra: haan", "• विदेश यात्रा: हाँ"),
  L("• Travel abroad: rarely or never", "• Videsh yatra: kabhi kabhaar ya nahi", "• विदेश यात्रा: कभी-कभार या नहीं"),
  L("• Covering: {x}", "• Cover: {x}", "• कवर: {x}"),
  L("• Age: {x}", "• Umar: {x}", "• उम्र: {x}"),
  L("• Income: {x}", "• Income: {x}", "• आमदनी: {x}"),
  L("• Spouse's age: {x}", "• Pati/patni ki umar: {x}", "• पति/पत्नी की उम्र: {x}"),
  L("• Children: {x}", "• Bachche: {x}", "• बच्चे: {x}"),
  L("• Parents' ages: {x}", "• Maa-baap ki umar: {x}", "• माता-पिता की उम्र: {x}"),
  L("• Employer cover: {x}", "• Company cover: {x}", "• कंपनी कवर: {x}"),
  L("• Risk: {x}", "• Risk: {x}", "• जोखिम: {x}"),
  L("• Hospitals: {x}", "• Hospital: {x}", "• अस्पताल: {x}"),
  L("• Regular medical costs: {x}", "• Niyamit ilaaj kharcha: {x}", "• नियमित इलाज ख़र्च: {x}"),
  L("Reply YES to calculate, or CHANGE and what to fix, for example: change age", "Calculate karne ke liye YES likhiye, ya badalne ke liye CHANGE, jaise: change age", "कैलकुलेट करने के लिए YES लिखिए, या बदलने के लिए CHANGE, जैसे: change age"),
  L("🧮 {c} recommended cover for {who}, {rest}.", "🧮 {who} ke liye {c} cover sahi rahega ({rest}).", "🧮 {who} के लिए {c} कवर सही रहेगा ({rest})।"),
  L("You can take it as one {a} policy, or as {b} base plus {c} super top-up, which is about {p}% less premium for the same cover.",
    "Ek {a} ki policy le sakte hain, ya {b} base + {c} super top-up, jisme usi cover ke liye lagbhag {p}% kam premium lagta hai.",
    "एक {a} की पॉलिसी ले सकते हैं, या {b} बेस + {c} सुपर टॉप-अप, जिसमें उसी कवर के लिए लगभग {p}% कम प्रीमियम लगता है।"),
  L("You can take it as one {a} policy, or as {b} base plus {c} super top-up.", "Ek {a} ki policy le sakte hain, ya {b} base + {c} super top-up.", "एक {a} की पॉलिसी ले सकते हैं, या {b} बेस + {c} सुपर टॉप-अप।"),
  L("A single {a} policy covers it.", "Ek {a} ki policy kaafi hai.", "एक {a} की पॉलिसी काफ़ी है।"),
  L("Full report with premiums and riders: {url}", "Premium aur riders ke saath poori report: {url}", "प्रीमियम और राइडर के साथ पूरी रिपोर्ट: {url}"),
  L("Saved to {n}'s record.", "{n} ke record mein save ho gaya.", "{n} के रिकॉर्ड में सेव हो गया।"),
  L("No customer called \"{n}\" in your book, so this won't be saved to a customer.", "\"{n}\" naam ka customer nahi mila, isliye yeh kisi customer ke record mein save nahi hoga.", "\"{n}\" नाम का कस्टमर नहीं मिला, इसलिए यह किसी कस्टमर के रिकॉर्ड में सेव नहीं होगा।"),

  /* Compare, website, lists */
  L("Which plans? For example: compare Care Supreme vs Niva ReAssure 2.0 (up to 4, separated by vs).", "Kaunse plans? Jaise: compare Care Supreme vs Niva ReAssure 2.0 (4 tak, beech mein vs).", "कौन से प्लान? जैसे: compare Care Supreme vs Niva ReAssure 2.0 (4 तक, बीच में vs)।"),
  L("⚖️ {w} is stronger on the wording than {o}.", "⚖️ Wording mein {w}, {o} se behtar hai.", "⚖️ शर्तों में {w}, {o} से बेहतर है।"),
  L("⚖️ {x} are too close to call on the wording.", "⚖️ Wording mein {x} lagbhag barabar hain.", "⚖️ शर्तों में {x} लगभग बराबर हैं।"),
  L("Why: {x}.", "Kyon: {x}.", "क्यों: {x}।"),
  L("But: {x}.", "Lekin: {x}.", "लेकिन: {x}।"),
  L("Full side-by-side: {url}", "Poori tulna: {url}", "पूरी तुलना: {url}"),
  L("\"{x}\" isn't a plan I know. Reply with a number from 1 to {n}, or type another plan name.", "\"{x}\" koi plan nahi mila. 1 se {n} tak number likhiye, ya koi aur plan ka naam.", "\"{x}\" कोई प्लान नहीं मिला। 1 से {n} तक नंबर लिखिए, या कोई और प्लान का नाम।"),
  L("Plan {n} of 2: which company?", "Plan {n} (2 mein se): kaunsi company?", "प्लान {n} (2 में से): कौन सी कंपनी?"),
  L("Reply with the number, or type the plan name.", "Number likhiye, ya plan ka naam.", "नंबर लिखिए, या प्लान का नाम।"),
  L("Which {x} plan?", "{x} ka kaunsa plan?", "{x} का कौन सा प्लान?"),
  L("Which plan should I compare it with? Type the plan name, for example: Care Supreme.", "Kis plan se tulna karni hai? Plan ka naam likhiye, jaise: Care Supreme.", "किस प्लान से तुलना करनी है? प्लान का नाम लिखिए, जैसे: Care Supreme।"),
  L("\"{q}\" matches too many plans. Type the insurer and plan name, for example: HDFC Optima Secure.", "\"{q}\" se bahut saare plan milte hain. Company aur plan ka naam likhiye, jaise: HDFC Optima Secure.", "\"{q}\" से बहुत सारे प्लान मिलते हैं। कंपनी और प्लान का नाम लिखिए, जैसे: HDFC Optima Secure।"),
  L("\"{q}\" isn't in the plan catalogue yet. The closest ones:", "\"{q}\" abhi plan list mein nahi hai. Sabse milte-julte:", "\"{q}\" अभी प्लान लिस्ट में नहीं है। सबसे मिलते-जुलते:"),
  L("\"{q}\" isn't in the plan catalogue yet. Type another plan name, or CANCEL.", "\"{q}\" abhi plan list mein nahi hai. Koi aur plan ka naam likhiye, ya CANCEL.", "\"{q}\" अभी प्लान लिस्ट में नहीं है। कोई और प्लान का नाम लिखिए, या CANCEL।"),
  L("Reply with a number, or type another plan name.", "Number likhiye, ya koi aur plan ka naam.", "नंबर लिखिए, या कोई और प्लान का नाम।"),
  L("Reply with the number, or type another plan name.", "Number likhiye, ya koi aur plan ka naam.", "नंबर लिखिए, या कोई और प्लान का नाम।"),
  L("Which \"{q}\"?", "Kaunsa \"{q}\"?", "कौन सा \"{q}\"?"),
  L("Those are the same plan. Pick a different one to compare.", "Yeh ek hi plan hai. Tulna ke liye koi doosra plan chuniye.", "यह एक ही प्लान है। तुलना के लिए कोई दूसरा प्लान चुनिए।"),
  L("Your website: {url}", "Aapki website: {url}", "आपकी वेबसाइट: {url}"),
  L("Leads from it land in your Leads in the portal.", "Wahan se aayi leads portal ki Leads mein dikhengi.", "वहाँ से आई लीड पोर्टल की Leads में दिखेंगी।"),
  L("Next: forward it to a customer, or put it in your WhatsApp status.", "Aage: customer ko forward kijiye, ya WhatsApp status mein lagaiye.", "आगे: कस्टमर को फ़ॉरवर्ड कीजिए, या WhatsApp स्टेटस में लगाइए।"),
  L("You haven't set up your website yet. It takes a couple of minutes in the portal: {url}", "Aapki website abhi bani nahi hai. Portal mein do minute lagte hain: {url}", "आपकी वेबसाइट अभी बनी नहीं है। पोर्टल में दो मिनट लगते हैं: {url}"),
  L("Your website is set up but not live yet. Publish it in the portal: {url}", "Website bani hai par live nahi hai. Portal mein publish kijiye: {url}", "वेबसाइट बनी है पर लाइव नहीं है। पोर्टल में पब्लिश कीजिए: {url}"),
  L("Ask about one by name, for example: {x}", "Naam se poochiye, jaise: {x}", "नाम से पूछिए, जैसे: {x}"),
  L("None of your shared reports have been opened yet. Share one with SHARE after a check.", "Abhi tak kisi ne shared report nahi kholi. Check ke baad SHARE se bhejiye.", "अभी तक किसी ने शेयर की हुई रिपोर्ट नहीं खोली। चेक के बाद SHARE से भेजिए।"),
  L("📋 {n} customer has opened their report, latest first:", "📋 {n} customer ne report kholi:", "📋 {n} कस्टमर ने रिपोर्ट खोली:"),
  L("📋 {n} customers have opened their report, latest first:", "📋 {n} customers ne report kholi, nayi pehle:", "📋 {n} कस्टमर ने रिपोर्ट खोली, नई पहले:"),
  L("A good moment to call. Their details: FIND {n}", "Call karne ka achha mauka hai. Details: FIND {n}", "कॉल करने का अच्छा मौका है। जानकारी: FIND {n}"),
  L("{n} hasn't opened a shared report yet.", "{n} ne abhi tak report nahi kholi.", "{n} ने अभी तक रिपोर्ट नहीं खोली।"),
  L("No open claims. Settled and rejected ones are in the portal.", "Koi chalu claim nahi. Settled aur rejected claims portal mein hain.", "कोई चालू क्लेम नहीं। सेटल और रिजेक्ट हुए क्लेम पोर्टल में हैं।"),
  L("Details on one: claim {n}", "Ek ki details: claim {n}", "एक की जानकारी: claim {n}"),
  L("Who should I look up? For example: find Ramesh", "Kisko dhoondhna hai? Jaise: find Ramesh", "किसे ढूँढना है? जैसे: find Ramesh"),

  L("There are no follow-ups due to move. Set one with: follow up Ramesh Friday", "Koi pending follow-up nahi hai. Aise set kijiye: Ramesh ko Friday follow up", "कोई बाकी फॉलो-अप नहीं है। ऐसे सेट कीजिए: रमेश को शुक्रवार फॉलो अप"),
  L("• Undo: put {n} leads back as they were", "• Undo: {n} leads pehle jaisi karein", "• अनडू: {n} लीड पहले जैसी करें"),
  L("Undone: {n} leads are back as they were.", "Undo ho gaya: {n} leads pehle jaisi hain.", "अनडू हो गया: {n} लीड पहले जैसी हैं।"),
  L("Which one?", "Kaunsa?", "कौन सा?"),
  L("Which {n}?", "Kaunsa {n}?", "कौन सा {n}?"),

  /* Generic "Next:" suggestions last: the command after it stays as typed. */
  L("Next: {x}", "Aage: {x}", "आगे: {x}"),
];

/** Pieces inside a confirm line ("• *Ramesh Kumar* (98123 45678): mark won, follow-up Fri 2 Oct"). */
const FRAGMENTS: { re: RegExp; hinglish: string; hindi: string }[] = [
  /* Stage 2d: life records (bot.ts lifeLine), translated phrase by phrase inside a confirm or reply line. */
  { re: /^✅ Recorded on (.+?): /, hinglish: "✅ $1 par likh diya: ", hindi: "✅ $1 पर लिख दिया: " },
  { re: /premium (₹[\d,]+) paid on (.+?), for the premium due ([^.।]+)/, hinglish: "$2 ko $1 premium bhara, $3 wale premium ke liye", hindi: "$2 को $1 प्रीमियम भरा, $3 वाले प्रीमियम के लिए" },
  { re: /no loan on the policy, as of today/, hinglish: "aaj ki tareekh mein policy par koi loan nahi", hindi: "आज की तारीख़ में पॉलिसी पर कोई लोन नहीं" },
  { re: /a loan of (₹[\d,]+) outstanding, as of today/, hinglish: "aaj ki tareekh mein $1 ka loan baaki", hindi: "आज की तारीख़ में $1 का लोन बाक़ी" },
  { re: /surrender value (₹[\d,]+), as quoted by the insurer on ([^.।]+)/, hinglish: "surrender value $1, insurer ke $2 ke quote ke anusaar", hindi: "सरेंडर वैल्यू $1, इंश्योरर के $2 के कोट के अनुसार" },
  { re: /up to (₹[\d,]+) can be borrowed, as quoted by the insurer on ([^.।]+)/, hinglish: "$1 tak ka loan mil sakta hai, insurer ke $2 ke quote ke anusaar", hindi: "$1 तक का लोन मिल सकता है, इंश्योरर के $2 के कोट के अनुसार" },
  { re: /policy status: (.+?), as stated by the insurer on ([^.।]+)/, hinglish: "policy status: $1, insurer ke $2 ke bayaan ke anusaar", hindi: "पॉलिसी स्टेटस: $1, इंश्योरर के $2 के बयान के अनुसार" },
  { re: /premiums paid up to and including the one due ([^.।]+)/, hinglish: "$1 tak ke saare premium bhare hue", hindi: "$1 तक के सारे प्रीमियम भरे हुए" },
  // After the record phrases above, whose dates stop at the "." these two replace.
  { re: /\. Saved as told by you, not checked against an insurer document/, hinglish: ". Aapke bataye anusaar save hoga, insurer ke document se check nahi kiya", hindi: "। आपके बताए अनुसार सेव होगा, इंश्योरर के दस्तावेज़ से जाँचा नहीं गया" },
  { re: /\. Note: the premium on file is (₹[\d,]+)/, hinglish: ". Dhyan dein: policy par premium $1 likha hai", hindi: "। ध्यान दें: पॉलिसी पर प्रीमियम $1 लिखा है" },
  { re: /^• No lead called (.+?) yet\. Add lead /, hinglish: "• $1 naam ki koi lead nahi hai. Nayi lead: ", hindi: "• $1 नाम की कोई लीड नहीं है। नई लीड: " },
  { re: /^• Add lead /, hinglish: "• Nayi lead: ", hindi: "• नई लीड: " },
  { re: /\bmark (won|lost|interested|contacted|new)\b/g, hinglish: "status $1", hindi: "स्टेटस $1" },
  { re: /\bmarked (won|lost|interested|contacted|new)\b/g, hinglish: "status $1", hindi: "स्टेटस $1" },
  { re: /\bfollow-up set for\b/g, hinglish: "follow-up", hindi: "फॉलो-अप" },
  { re: /\bfollow-up (?=\w{3} \d)/g, hinglish: "follow-up ", hindi: "फॉलो-अप " },
  { re: /\bnote added\b/g, hinglish: "note jud gaya", hindi: "नोट जुड़ गया" },
  { re: /\bnote "/g, hinglish: "note \"", hindi: "नोट \"" },
  // Inside list lines: "· overdue 31d", "· overdue since 2000-01-01", "· today", "· 5d left", "(due today)"
  { re: / · overdue (\d+)d\b/g, hinglish: " · $1 din se pending", hindi: " · $1 दिन से बाकी" },
  { re: / · overdue since ([\d-]+)/g, hinglish: " · $1 se pending", hindi: " · $1 से बाकी" },
  { re: / · today(?= ·|$)/g, hinglish: " · aaj", hindi: " · आज" },
  { re: /\((\d+)d left\)/g, hinglish: "($1 din baaki)", hindi: "($1 दिन बाकी)" },
  { re: /\(overdue (\d+)d\)/g, hinglish: "($1 din se pending)", hindi: "($1 दिन से बाकी)" },
  { re: /\(due today\)/g, hinglish: "(aaj due)", hindi: "(आज बाकी)" },
];

/** A reply in the advisor's language. English is returned untouched. */
export function localise(text: string, lang: ReplyLang | undefined | null): string {
  if (!lang || lang === "english") return text;
  return text.split("\n").map((line) => {
    for (const r of LINES) if (r.re.test(line)) return line.replace(r.re, r[lang]);
    let out = line;
    for (const f of FRAGMENTS) out = out.replace(f.re, f[lang]);
    return out;
  }).join("\n");
}
