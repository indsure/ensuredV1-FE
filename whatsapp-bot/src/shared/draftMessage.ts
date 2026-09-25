/**
 * Local WhatsApp message templates (no AI, no backend, zero cost).
 *
 * The agent picks an intent + language; we fill a short template with the
 * person's name / insurer / renewal date / weak point entirely on the device.
 * They can edit the result, then tap "Send on WhatsApp" (wa.me one-tap).
 *
 * Same builder serves both leads and existing clients. Templates are plain,
 * warm and em-dash-free, written for the 40+ client base.
 */

import { format } from "date-fns";

/** Preset intents the agent can pick. `custom` gives a blank scaffold to fill. */
export const DRAFT_KINDS = [
  "upgrade_weak",
  "renewal",
  "premium_due",
  "review",
  "follow_up",
  "thank_you",
  "festival",
  "custom",
] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** Plain-language labels for the intent picker. Client-only intents are flagged. */
export const DRAFT_KIND_META: Record<DraftKind, { label: string; emoji: string; clientOnly?: boolean }> = {
  upgrade_weak: { label: "Suggest an upgrade", emoji: "⬆️", clientOnly: true },
  renewal:      { label: "Renewal reminder",   emoji: "🔔", clientOnly: true },
  premium_due:  { label: "Premium due",        emoji: "💳", clientOnly: true },
  review:       { label: "Offer a free review", emoji: "🔍" },
  follow_up:    { label: "Follow up",          emoji: "👋" },
  thank_you:    { label: "Say thank you",      emoji: "🙏" },
  festival:     { label: "Festival greeting",  emoji: "🎉" },
  custom:       { label: "Write my own",       emoji: "✍️" },
};

export type DraftLanguage = "english" | "hinglish" | "hindi";
export const DRAFT_LANGUAGES: { value: DraftLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "hinglish", label: "Hinglish" },
  { value: "hindi", label: "हिंदी" },
];

export type DraftTarget = {
  type: "client" | "lead";
  id: string;
  name?: string | null;
  phone?: string | null;
  /** Extra context used to personalise templates (filled where available). */
  insurer?: string | null;
  renewalDate?: string | null; // ISO date string
  weakPoint?: string | null;   // top failure point, for the upgrade nudge
  interest?: string | null;    // lead's insurance interest
};

/* ── Template builder ───────────────────────────────────────────────────── */

function firstName(name?: string | null): string {
  const n = (name || "").trim().split(/\s+/)[0];
  return n || "ji";
}

function prettyDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : format(d, "d MMMM");
}

/** Join non-empty lines, then strip any stray em/en dashes as a backstop. */
function lines(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join("\n").replace(/[—–]/g, ", ");
}

/** Lowercase only the first letter, so a weak point reads naturally mid-sentence
 *  without mangling tokens like "Rs" or insurer names. */
function lcFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Greeting + blank body + sign-off, for the "Write my own" scaffold. */
function scaffold(f: Frame): string {
  return `${f.hi}\n\n\n${f.sign}`.replace(/[—–]/g, ", ");
}

/**
 * Build the message text locally. Returns ready-to-send WhatsApp copy.
 * `agentName` signs the message off; falls back to a neutral sign-off.
 */
export function buildMessage(
  target: DraftTarget,
  kind: DraftKind,
  language: DraftLanguage,
  agentName?: string | null
): string {
  const first = firstName(target.name);
  const insurer = (target.insurer || "").trim();
  const date = prettyDate(target.renewalDate);
  const weak = (target.weakPoint || "").trim();
  const interest = (target.interest || "").trim();
  const agent = (agentName || "").trim();

  const en = {
    hi: `Hello ${first},`,
    sign: agent ? `Thanks,\n${agent}` : `Thanks,\nYour insurance advisor`,
  };
  const hg = {
    hi: `Namaste ${first} ji,`,
    sign: agent ? `Dhanyavaad,\n${agent}` : `Dhanyavaad,\nAapka insurance advisor`,
  };
  const hn = {
    hi: `नमस्ते ${first} जी,`,
    sign: agent ? `धन्यवाद,\n${agent}` : `धन्यवाद,\nआपका बीमा सलाहकार`,
  };

  switch (language) {
    case "hinglish":
      return hinglish(kind, hg, { first, insurer, date, weak, interest });
    case "hindi":
      return hindi(kind, hn, { first, insurer, date, weak, interest });
    default:
      return english(kind, en, { first, insurer, date, weak, interest });
  }
}

type Ctx = { first: string; insurer: string; date: string | null; weak: string; interest: string };
type Frame = { hi: string; sign: string };

function english(kind: DraftKind, f: Frame, c: Ctx): string {
  switch (kind) {
    case "upgrade_weak":
      return lines(
        f.hi,
        `I was reviewing your ${c.insurer || "current"} policy and noticed a few gaps${c.weak ? ` (for example, ${lcFirst(c.weak)})` : ""} that could leave you under-protected.`,
        `The good news is we can move you to a stronger plan in roughly the same premium range.`,
        `Would you like me to find the right upgrade for you? Just reply here.`,
        ``, f.sign,
      );
    case "renewal":
      return lines(
        f.hi,
        `A friendly reminder that your ${c.insurer || "insurance"} policy is due for renewal${c.date ? ` on ${c.date}` : " soon"}.`,
        `Please renew on time so your cover does not lapse.`,
        `I am happy to help you renew or review it before you pay. Just let me know.`,
        ``, f.sign,
      );
    case "premium_due":
      return lines(
        f.hi,
        `A gentle reminder that your premium payment${c.date ? ` is due on ${c.date}` : " is due soon"}.`,
        `Kindly pay on time to keep your policy active.`,
        `If you have any question before paying, just message me.`,
        ``, f.sign,
      );
    case "review":
      return lines(
        f.hi,
        `It has been a while, so I would like to offer you a free review of your insurance to make sure it still fits your needs.`,
        `It only takes a few minutes and there is no cost.`,
        `Shall I set up a quick call this week?`,
        ``, f.sign,
      );
    case "follow_up":
      return lines(
        f.hi,
        `Just following up on our earlier conversation${c.interest ? ` about ${c.interest} insurance` : ""}.`,
        `Have you had a chance to think it over? I am happy to answer any questions.`,
        ``, f.sign,
      );
    case "thank_you":
      return lines(
        f.hi,
        `Thank you for trusting me with your insurance. It truly means a lot.`,
        `I am always just one message away if you ever need anything.`,
        ``, f.sign,
      );
    case "festival":
      return lines(
        f.hi,
        `Wishing you and your family a very happy and prosperous festival season.`,
        `May this year bring you good health, happiness and peace of mind.`,
        ``, f.sign,
      );
    case "custom":
    default:
      return scaffold(f);
  }
}

function hinglish(kind: DraftKind, f: Frame, c: Ctx): string {
  switch (kind) {
    case "upgrade_weak":
      return lines(
        f.hi,
        `Main aapki ${c.insurer || "current"} policy dekh raha tha aur usme kuch kami${c.weak ? ` (jaise ${lcFirst(c.weak)})` : ""} nazar aayi, jisse aapka cover kamzor reh sakta hai.`,
        `Achhi baat ye hai ki hum aapko lagbhag utne hi premium me ek behtar plan de sakte hain.`,
        `Kya main aapke liye sahi upgrade dhoondh doon? Bas yahin reply kar dijiye.`,
        ``, f.sign,
      );
    case "renewal":
      return lines(
        f.hi,
        `Yaad dilane ke liye, aapki ${c.insurer || "insurance"} policy ka renewal${c.date ? ` ${c.date} ko` : " jaldi"} aa raha hai.`,
        `Kripya time par renew kara lijiye taaki aapka cover band na ho.`,
        `Renew ya review me meri madad chahiye to bata dijiye.`,
        ``, f.sign,
      );
    case "premium_due":
      return lines(
        f.hi,
        `Ek halki si yaad, aapka premium${c.date ? ` ${c.date} ko` : " jaldi"} due hai.`,
        `Policy active rakhne ke liye time par payment kar dijiye.`,
        `Pay karne se pehle koi sawaal ho to mujhe message kijiye.`,
        ``, f.sign,
      );
    case "review":
      return lines(
        f.hi,
        `Kaafi time ho gaya, isliye main aapko aapki insurance ka ek free review offer karna chahta hoon, taaki ye aapki zaroorat ke hisaab se sahi rahe.`,
        `Bas kuch minute lagenge aur koi charge nahi hai.`,
        `Is hafte ek chhoti si call set kar doon?`,
        ``, f.sign,
      );
    case "follow_up":
      return lines(
        f.hi,
        `Hamari pichhli baat${c.interest ? ` ${c.interest} insurance ke baare me` : ""} par follow up kar raha hoon.`,
        `Kya aapne soch liya? Koi bhi sawaal ho to main hazir hoon.`,
        ``, f.sign,
      );
    case "thank_you":
      return lines(
        f.hi,
        `Apni insurance ke liye mujh par bharosa karne ke liye bahut dhanyavaad. Iski mujhe bahut kadar hai.`,
        `Kabhi bhi kuch zaroorat ho to main bas ek message door hoon.`,
        ``, f.sign,
      );
    case "festival":
      return lines(
        f.hi,
        `Aapko aur aapke parivaar ko festival season ki bahut bahut shubhkamnaayein.`,
        `Ye saal aapke liye sehat, khushi aur sukoon laaye.`,
        ``, f.sign,
      );
    case "custom":
    default:
      return scaffold(f);
  }
}

function hindi(kind: DraftKind, f: Frame, c: Ctx): string {
  switch (kind) {
    case "upgrade_weak":
      return lines(
        f.hi,
        `मैं आपकी ${c.insurer || "मौजूदा"} पॉलिसी देख रहा था और उसमें कुछ कमियाँ${c.weak ? ` (जैसे ${c.weak})` : ""} नज़र आईं, जिससे आपका कवर कमज़ोर रह सकता है।`,
        `अच्छी बात यह है कि हम आपको लगभग उतने ही प्रीमियम में एक बेहतर प्लान दे सकते हैं।`,
        `क्या मैं आपके लिए सही अपग्रेड ढूँढ दूँ? बस यहीं जवाब दे दीजिए।`,
        ``, f.sign,
      );
    case "renewal":
      return lines(
        f.hi,
        `याद दिलाने के लिए, आपकी ${c.insurer || "बीमा"} पॉलिसी का रिन्यूअल${c.date ? ` ${c.date} को` : " जल्दी"} आ रहा है।`,
        `कृपया समय पर रिन्यू करा लीजिए ताकि आपका कवर बंद न हो।`,
        `रिन्यू या रिव्यू में मेरी मदद चाहिए तो बता दीजिए।`,
        ``, f.sign,
      );
    case "premium_due":
      return lines(
        f.hi,
        `एक हल्की सी याद, आपका प्रीमियम${c.date ? ` ${c.date} को` : " जल्दी"} देय है।`,
        `पॉलिसी चालू रखने के लिए समय पर भुगतान कर दीजिए।`,
        `भुगतान से पहले कोई सवाल हो तो मुझे मैसेज कीजिए।`,
        ``, f.sign,
      );
    case "review":
      return lines(
        f.hi,
        `काफ़ी समय हो गया, इसलिए मैं आपको आपकी बीमा का एक मुफ़्त रिव्यू देना चाहता हूँ, ताकि यह आपकी ज़रूरत के हिसाब से सही रहे।`,
        `बस कुछ मिनट लगेंगे और कोई शुल्क नहीं है।`,
        `इस हफ़्ते एक छोटी सी कॉल सेट कर दूँ?`,
        ``, f.sign,
      );
    case "follow_up":
      return lines(
        f.hi,
        `हमारी पिछली बात${c.interest ? ` ${c.interest} बीमा के बारे में` : ""} पर फॉलो अप कर रहा हूँ।`,
        `क्या आपने सोच लिया? कोई भी सवाल हो तो मैं हाज़िर हूँ।`,
        ``, f.sign,
      );
    case "thank_you":
      return lines(
        f.hi,
        `अपनी बीमा के लिए मुझ पर भरोसा करने के लिए बहुत धन्यवाद। इसकी मुझे बहुत कद्र है।`,
        `कभी भी कुछ ज़रूरत हो तो मैं बस एक मैसेज दूर हूँ।`,
        ``, f.sign,
      );
    case "festival":
      return lines(
        f.hi,
        `आपको और आपके परिवार को त्योहारों की बहुत बहुत शुभकामनाएँ।`,
        `यह साल आपके लिए सेहत, ख़ुशी और शांति लाए।`,
        ``, f.sign,
      );
    case "custom":
    default:
      return scaffold(f);
  }
}
