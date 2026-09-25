// Strings for the WhatsApp card, English and Hindi, kept INSIDE this plug-in folder so
// unplugging never means editing the shared locale files.

export const STRINGS = {
  en: {
    title: "WhatsApp (beta)",
    intro: "Send a customer's health policy PDF to the IndSure WhatsApp number and get the report back in the same chat. You can also ask about a report, get a share message for your customer, and see renewals.",
    number_label: "Your WhatsApp number",
    number_placeholder: "10-digit mobile number",
    get_code: "Get my code",
    getting_code: "Getting code...",
    send_this: "From this WhatsApp number, send this message to",
    the_bot: "the IndSure WhatsApp number",
    code_expires: "The code works for 10 minutes.",
    open_whatsapp: "Open WhatsApp with this message",
    check_again: "I've sent it, check again",
    connected_as: "Connected:",
    disconnect: "Disconnect",
    disconnecting: "Disconnecting...",
    disconnected: "WhatsApp disconnected.",
    never_sends: "IndSure never messages your customers. It only replies to you, and you press send yourself.",
    beta_note: "This is a beta number and it may change. We'll tell you if it does.",
    load_failed: "Couldn't load your WhatsApp connection.",
  },
  hi: {
    title: "WhatsApp (बीटा)",
    intro: "ग्राहक की हेल्थ पॉलिसी की PDF, IndSure के WhatsApp नंबर पर भेजें और उसी चैट में रिपोर्ट पाएं। आप रिपोर्ट के बारे में सवाल पूछ सकते हैं, ग्राहक के लिए भेजने लायक मैसेज ले सकते हैं, और रिन्यूअल देख सकते हैं।",
    number_label: "आपका WhatsApp नंबर",
    number_placeholder: "10 अंकों का मोबाइल नंबर",
    get_code: "मेरा कोड पाएं",
    getting_code: "कोड आ रहा है...",
    send_this: "इसी WhatsApp नंबर से, यह मैसेज इस नंबर पर भेजें:",
    the_bot: "IndSure का WhatsApp नंबर",
    code_expires: "यह कोड 10 मिनट तक काम करेगा।",
    open_whatsapp: "यह मैसेज WhatsApp में खोलें",
    check_again: "मैंने भेज दिया, फिर से देखें",
    connected_as: "जुड़ा हुआ नंबर:",
    disconnect: "हटाएं",
    disconnecting: "हटा रहे हैं...",
    disconnected: "WhatsApp हटा दिया गया।",
    never_sends: "IndSure आपके ग्राहकों को कभी मैसेज नहीं भेजता। वह सिर्फ़ आपको जवाब देता है, और भेजने का बटन आप खुद दबाते हैं।",
    beta_note: "यह बीटा नंबर है और बदल सकता है। बदलने पर हम आपको बताएंगे।",
    load_failed: "आपका WhatsApp कनेक्शन लोड नहीं हो सका।",
  },
} as const

export type WaStringKey = keyof typeof STRINGS.en
