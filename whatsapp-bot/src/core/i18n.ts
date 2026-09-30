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

// Order matters: a specific line comes before a general one that would also match it.
const LINES: Line[] = [
  /* Help and menus */
  L("📋 Here's what I do most:", "📋 Aap mujhse yeh sab karwa sakte hain:", "📋 आप मुझसे ये सब करवा सकते हैं:"),
  L("• Send a health policy PDF and I'll check it", "• Health policy ki PDF bhejiye, uski report mil jayegi", "• हेल्थ पॉलिसी की PDF भेजिए, उसकी रिपोर्ट मिल जाएगी"),
  L("• RENEWALS or FOLLOW UPS: who to call", "• RENEWALS ya FOLLOW UPS: kisko call karna hai", "• RENEWALS या FOLLOW UPS: किसे कॉल करना है"),
  L("• CALCULATOR, or COMPARE Care Supreme vs ReAssure 2.0", "• CALCULATOR, ya COMPARE Care Supreme vs ReAssure 2.0", "• CALCULATOR, या COMPARE Care Supreme vs ReAssure 2.0"),
  L("Or just tell me what you need. Reply MORE for everything else.", "Ya seedha likhiye kya chahiye. Baaki sab ke liye MORE likhiye.", "या सीधे लिखिए क्या चाहिए। बाकी सब के लिए MORE लिखिए।"),
  L("📋 Everything I can do:", "📋 Saare kaam:", "📋 सारे काम:"),
  L("• Send a health policy PDF, then ask: room rent? co-pay?", "• Health policy ki PDF bhejiye, phir poochiye: room rent? co-pay?", "• हेल्थ पॉलिसी की PDF भेजिए, फिर पूछिए: room rent? co-pay?"),
  L("• SHARE: a message for the customer (report, calculator or comparison)", "• SHARE: customer ke liye message (report, calculator ya comparison)", "• SHARE: कस्टमर के लिए मैसेज (रिपोर्ट, कैलकुलेटर या तुलना)"),
  L("• LEAD Ramesh 98123 45678 health · Ramesh won · follow up Ramesh Friday · note Ramesh: wants family floater",
    "• LEAD Ramesh 98123 45678 health · Ramesh ne policy le li · Ramesh ko Friday follow up · note Ramesh: family floater chahiye",
    "• LEAD Ramesh 98123 45678 health · रमेश ने पॉलिसी ले ली · रमेश को शुक्रवार फॉलो अप · note Ramesh: family floater चाहिए"),
  L("• FIND Ramesh: everything on a name or number", "• FIND Ramesh: kisi naam ya number ki poori jaankari", "• FIND Ramesh: किसी नाम या नंबर की पूरी जानकारी"),
  L("• SURRENDER VALUE Ramesh (life policies)", "• SURRENDER VALUE Ramesh (life policy ke liye)", "• SURRENDER VALUE Ramesh (लाइफ़ पॉलिसी के लिए)"),
  L("• LINK: your website", "• LINK: aapki website", "• LINK: आपकी वेबसाइट"),
  L("• TODAY: your to-do · BALANCE: checks and Sach Assistant replies left · MORNING OFF / ON",
    "• TODAY: aaj ka kaam · BALANCE: bache hue checks aur Sach Assistant jawab · MORNING OFF / ON",
    "• TODAY: आज का काम · BALANCE: बचे हुए चेक और Sach Assistant जवाब · MORNING OFF / ON"),
  L("• HINDI, HINGLISH or ENGLISH: the language I reply in", "• HINDI, HINGLISH ya ENGLISH: jawab kis bhasha mein aaye", "• HINDI, HINGLISH या ENGLISH: जवाब किस भाषा में आए"),
  L("I didn't catch that.", "Samajh nahi aaya.", "समझ नहीं आया।"),
  L("Happy to help.", "Khushi hui madad karke.", "मदद करके ख़ुशी हुई।"),
  L("Something went wrong on my side. Please try again in a minute.", "Hamari taraf se kuch gadbad ho gayi. Ek minute baad dobara try kijiye.", "हमारी तरफ़ से कुछ गड़बड़ हो गई। एक मिनट बाद दोबारा कोशिश कीजिए।"),
  L("Okay, cancelled. Send a PDF or type HELP any time.", "Theek hai, cancel kar diya. Kabhi bhi PDF bhejiye ya HELP likhiye.", "ठीक है, रद्द कर दिया। कभी भी PDF भेजिए या HELP लिखिए।"),
  L("You're connected to IndSure. Send me a customer's health policy PDF and I'll send back the report. You can also type RENEWALS or HELP.",
    "Aap IndSure se jud gaye hain. Customer ki health policy ki PDF bhejiye, report yahin aa jayegi. RENEWALS ya HELP bhi likh sakte hain.",
    "आप IndSure से जुड़ गए हैं। कस्टमर की हेल्थ पॉलिसी की PDF भेजिए, रिपोर्ट यहीं आ जाएगी। RENEWALS या HELP भी लिख सकते हैं।"),
  L("Done. This WhatsApp number is no longer connected to your IndSure account.", "Ho gaya. Yeh WhatsApp number ab aapke IndSure account se juda nahi hai.", "हो गया। यह WhatsApp नंबर अब आपके IndSure खाते से जुड़ा नहीं है।"),

  /* Policy PDFs */
  L("Got it. Checking this policy now, usually about a minute.", "Mil gaya. Policy check ho rahi hai, aam taur par ek minute lagta hai.", "मिल गया। पॉलिसी चेक हो रही है, आमतौर पर एक मिनट लगता है।"),
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
