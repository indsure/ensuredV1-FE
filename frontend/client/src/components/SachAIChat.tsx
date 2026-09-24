import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { getApiBase } from "@/lib/queryClient";
import { useAnalysis } from "@/hooks/use-analysis";
import { Send, X, Trash2, Bot, Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { CLAUSE_LIBRARY } from "@/data/clause-library";
import { useLanguage } from "@/i18n/LanguageContext";

// Simple markdown parser for bold, italic, and lists
const SimpleMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="space-y-3 leading-relaxed text-[var(--color-text-main)]">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[15px]">
          {para.split(/(\*\*[\s\S]*?\*\*|`[\s\S]*?`)/g).map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={j} className="font-bold text-[var(--color-text-main)]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith("`") && part.endsWith("`")) {
              return <code key={j} className="bg-[var(--color-border-light)] px-1.5 py-0.5 rounded-sm font-mono text-xs text-[var(--color-text-secondary)]">{part.slice(1, -1)}</code>;
            }
            if (part.trim().startsWith("- ")) {
              const listItems = part.split("\n").filter(l => l.trim().startsWith("- "));
              if (listItems.length > 0) {
                return (
                  <ul key={j} className="list-disc pl-5 space-y-1.5 mt-2 mb-2 marker:text-[var(--color-text-muted)]">
                    {listItems.map((item, k) => (
                      <li key={k} className="pl-1 text-[var(--color-text-secondary)]">{item.replace(/^- /, "")}</li>
                    ))}
                  </ul>
                )
              }
            }
            return part;
          })}
        </p>
      ))}
    </div>
  );
};

// Every one of these resolves from stored data, so each is a zero-cost answer
// rather than a prompt. They double as a hint at what Sach can actually read.
//
// `q` is what is sent. It stays English because the server matches English
// clause names; `label` is the translation key shown on the button.
const SUGGESTED_QUESTIONS = [
  { q: "Am I covered for robotic surgery?", label: "sach.q1" },
  { q: "What is my room rent limit?", label: "sach.q2" },
  { q: "Is there a co-pay on my policy?", label: "sach.q3" },
  { q: "How long is my pre-existing disease waiting?", label: "sach.q4" },
];

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SACH_AI_MAX_INPUT_CHARS = 500;
const SACH_AI_RATE_LIMIT = 60;
const SACH_AI_SESSION_ID_KEY = "sach_ai_session_id";
const SACH_AI_MESSAGE_COUNT_KEY = "sach_ai_message_count";


function containsPersonalData(text: string): boolean {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /\b(?:\+?91[\s-]?)?\d{10}\b/;
  const aadhaar = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/; // xxxx-xxxx-xxxx
  const aadhaarPlain = /\b\d{12}\b/;
  const policyLike = /\b(?:policy|pol)\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*[A-Za-z0-9\/]{5,}\b/i;

  return email.test(text) || phone.test(text) || aadhaar.test(text) || aadhaarPlain.test(text) || policyLike.test(text);
}


/**
 * General insurance questions are answered from the /learn clause library, which
 * already ships in this bundle. Resolving it here rather than on the server keeps
 * one copy of the content and means a definition costs no network call at all.
 *
 * Matching is on the canonical term and its `aka` list, longest phrase first so
 * "pre-existing disease" is not swallowed by "disease".
 */
const GLOSSARY_INDEX = CLAUSE_LIBRARY
  .flatMap((e) => [e.term, ...(e.aka ?? [])].map((phrase) => ({ phrase: phrase.toLowerCase(), entry: e })))
  .sort((a, b) => b.phrase.length - a.phrase.length);

function answerFromGlossary(question: string): string | null {
  const q = question.toLowerCase();
  const hit = GLOSSARY_INDEX.find(({ phrase }) => q.includes(phrase));
  if (!hit) return null;
  return [
    `**${hit.entry.term}**`,
    hit.entry.shortAnswer,
    `Read the full explanation: /learn/${hit.entry.slug}`,
  ].join("\n\n");
}

export default function SachAIChat() {
  const [location] = useLocation();
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [sachSessionId] = useState(() => {
    try {
      const existing = window.sessionStorage.getItem(SACH_AI_SESSION_ID_KEY);
      if (existing) return existing;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SACH_AI_SESSION_ID_KEY, id);
      if (!window.sessionStorage.getItem(SACH_AI_MESSAGE_COUNT_KEY)) {
        window.sessionStorage.setItem(SACH_AI_MESSAGE_COUNT_KEY, "0");
      }
      return id;
    } catch {
      return `sach-local-${Date.now()}`;
    }
  });

  const [messageCount, setMessageCount] = useState<number>(() => {
    try {
      return Number(window.sessionStorage.getItem(SACH_AI_MESSAGE_COUNT_KEY) ?? "0") || 0;
    } catch {
      return 0;
    }
  });

  // Null while the session is still being read, so the bubble does not flash in
  // and out on first paint.
  const [signedIn, setSignedIn] = useState<boolean>(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data?.session?.access_token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedIn(Boolean(session?.access_token));
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const { currentJobId, state } = useAnalysis();
  const hasPolicy = !!(currentJobId || state?.analysis);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendMessage(text?: string) {
    const raw = text ?? input;
    const messageText = raw.trim();
    if (!messageText || loading) return;

    const userMessage: Message = { role: "user", content: messageText };

    const setLastAssistantContent = (content: string) => {
      setMessages((prev: Message[]) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", content };
        } else {
          copy.push({ role: "assistant", content });
        }
        return copy;
      });
    };

    // Frontend guardrails (backend will enforce too).
    if (userMessage.content.length > SACH_AI_MAX_INPUT_CHARS) {
      setMessages((prev: Message[]) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: t("sach.too_long", { n: SACH_AI_MAX_INPUT_CHARS }),
        },
      ]);
      setInput("");
      return;
    }

    if (messageCount >= SACH_AI_RATE_LIMIT) {
      setMessages((prev: Message[]) => [
        ...prev,
        userMessage,
        { role: "assistant", content: t("sach.rate_limit", { n: SACH_AI_RATE_LIMIT }) },
      ]);
      setInput("");
      return;
    }

    if (containsPersonalData(userMessage.content)) {
      setMessages((prev: Message[]) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: t("sach.personal"),
        },
      ]);
      setInput("");
      return;
    }

    // Signed out, anywhere on the site: general insurance terms still answer from the clause
    // library bundled here, with no network call at all. Anything that needs someone's own
    // policy cannot be answered without a session, so say that plainly rather than letting the
    // request come back as a bare 401.
    if (!signedIn) {
      const general = answerFromGlossary(userMessage.content);
      setMessages((prev: Message[]) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: general ?? t("sach.signed_out"),
        },
      ]);
      setInput("");
      return;
    }

    const historyForRequest: Message[] = [...messages, userMessage];

    // Add placeholder immediately to avoid race conditions while streaming.
    setMessages((prev: Message[]) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    setIsTyping(true);
    // Mirror backend rate limiting (it increments once the request passes guardrails).
    setMessageCount((prev) => {
      const next = prev + 1;
      try {
        window.sessionStorage.setItem(SACH_AI_MESSAGE_COUNT_KEY, String(next));
      } catch {}
      return next;
    });

    const parseError = async (res: Response) => {
      try {
        const data = await res.json();
        const msg = data?.message || `API Error: ${res.status}`;
        const details = data?.details ? ` (${data.details})` : "";
        return `${msg}${details}`;
      } catch {
        try {
          const t = await res.text();
          return t ? t : `API Error: ${res.status}`;
        } catch {
          return `API Error: ${res.status}`;
        }
      }
    };

    try {
      // Use non-streaming mode by default due to Node.js Web Streams API compatibility issues
      // Streaming can be re-enabled once the backend SDK issue is resolved
      const res = await apiFetch("/api/sach-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyForRequest,
          jobId: currentJobId,
          sessionId: sachSessionId,
        }),
      });

      if (!res.ok) {
        const msg = await parseError(res);
        setLastAssistantContent(msg);
        return;
      }

      const data = await res.json();

      // kind:"general" means the server understood no clause, so the answer
      // comes from the clause library bundled here. No model is involved on
      // either side of this call.
      let content = typeof data?.content === "string" ? data.content : "";
      if (!content && data?.kind === "general") {
        content = answerFromGlossary(messageText) ?? t("sach.no_general");
      }
      if (Array.isArray(data?.links) && data.links.length) {
        content += "\n\n" + data.links.map((l: any) => `${l.label}: ${l.href}`).join("\n");
      }
      setLastAssistantContent(content || t("sach.no_answer"));

      // success
    } catch (err: any) {
      // Error handling
      setLastAssistantContent(
        err?.message ? t("sach.err_with", { msg: err.message }) : t("sach.unavailable")
      );
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  }

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  // Sach reads policy data, so it renders only inside the two signed-in portals
  // (agent and consumer) and never on public or admin surfaces. The session
  // check matters as well as the route: without a token every answer would come
  // back 401, and a chat bubble that can only apologise is worse than no bubble.
  // Everywhere except the admin console. Signed in, it reads your own policy; signed out, it
  // still explains any insurance term from the bundled clause library. Admin is excluded
  // because it is an internal tool operating on other people's data, not a place to ask about
  // "your" cover.
  if (location.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 group flex items-center justify-center w-14 h-14 bg-[var(--color-green-primary)] text-white rounded-full shadow-xl border border-[var(--color-green-secondary)] hover:scale-105 transition-all duration-300 hover:shadow-2xl"
          aria-label={t("sach.open")}
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-[95vw] md:w-[400px] h-[600px] max-h-[80vh] md:max-h-[85vh] bg-white border border-[var(--color-border-main)] shadow-2xl z-50 rounded-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300 font-sans">

          {/* Header */}
          <div className="bg-[var(--color-green-primary)] p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-full text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-serif font-bold text-lg leading-none tracking-wide">Sach</h3>
                <p className="text-white/60 text-xs uppercase tracking-widest mt-1">
                  {t("sach.reads")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} className="text-white/60 hover:text-white transition-colors" title={t("sach.clear")} aria-label={t("sach.clear")}>
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors" title={t("sach.close")} aria-label={t("sach.close")}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[var(--color-cream-main)]">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-60">
                <div className="w-12 h-12 bg-[var(--color-green-primary)]/10 text-[var(--color-green-primary)] rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="font-serif text-[var(--color-text-main)] text-xl mb-2 font-bold">{t("sach.help")}</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
                  {t("sach.ask_what")}
                </p>
                {locale === "hi" && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("sach.english_note")}</p>
                )}

                {!hasPolicy && (
                  <div className="w-full mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
                    <p className="text-xs font-semibold text-amber-700 mb-1">{t("sach.no_policy")}</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      {t("sach.for_specific")}{" "}
                      <a href="/policychecker" className="underline font-medium">{t("sach.upload_first")}</a>.{" "}
                      {t("sach.still_explain")}
                    </p>
                  </div>
                )}

                <div className="w-full space-y-2">
                  {SUGGESTED_QUESTIONS.map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(sq.q)}
                      className="w-full text-left text-xs p-3 bg-white border border-[var(--color-border-light)] hover:border-[var(--color-green-primary)] rounded-lg transition-colors text-[var(--color-text-secondary)] shadow-sm"
                    >
                      {t(sq.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m: Message, i: number) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {/* Bot Message */}
                {m.role === "assistant" && (
                  <div className="max-w-[85%] bg-white border border-[var(--color-border-light)] px-5 py-4 rounded-xl rounded-tl-none shadow-sm text-sm">
                    <SimpleMarkdown content={m.content} />
                  </div>
                )}
                {/* User Message */}
                {m.role === "user" && (
                  <div className="max-w-[85%] bg-[var(--color-green-primary)] text-white px-5 py-4 rounded-xl rounded-tr-none text-sm shadow-sm font-medium">
                    <SimpleMarkdown content={m.content} />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-[var(--color-green-primary)] text-xs font-mono uppercase tracking-widest pl-2">
                <Loader2 className="w-3 h-3 animate-spin" /> {t("sach.thinking")}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-[var(--color-border-light)] shrink-0">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={t("sach.placeholder")}
                className="w-full pl-4 pr-12 py-3 bg-[var(--color-cream-main)] border border-[var(--color-border-light)] focus:border-[var(--color-green-primary)] rounded-lg outline-none text-sm transition-all placeholder:text-[var(--color-text-muted)] text-[var(--color-text-main)]"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                aria-label={t("sach.send")}
                className="absolute right-2 p-1.5 bg-[var(--color-green-primary)] text-white rounded-md hover:bg-[var(--color-green-secondary)] transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-center text-[var(--color-text-muted)] mt-2 font-mono uppercase tracking-wider">
              {t("sach.footer")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
