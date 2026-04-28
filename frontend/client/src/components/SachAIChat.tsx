import { useState, useRef, useEffect } from "react";
import { getApiBase } from "@/lib/queryClient";
import { useAnalysis } from "@/hooks/use-analysis";
import { Send, X, Trash2, Bot, Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

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

const SUGGESTED_QUESTIONS = [
  "Does this policy cover robotic surgery?",
  "What are the waiting periods?",
  "Is there a copay for senior citizens?",
  "Are there any room rent capping limits?",
];

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SACH_AI_MAX_INPUT_CHARS = 500;
const SACH_AI_RATE_LIMIT = 20;
const SACH_AI_SESSION_ID_KEY = "sach_ai_session_id";
const SACH_AI_MESSAGE_COUNT_KEY = "sach_ai_message_count";

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Marathi", label: "Marathi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Tamil", label: "Tamil" },
  { value: "Telugu", label: "Telugu" },
  { value: "Kannada", label: "Kannada" },
  { value: "Bengali", label: "Bengali" },
];

function containsPersonalData(text: string): boolean {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /\b(?:\+?91[\s-]?)?\d{10}\b/;
  const aadhaar = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/; // xxxx-xxxx-xxxx
  const aadhaarPlain = /\b\d{12}\b/;
  const policyLike = /\b(?:POLICY|POL|POL-\s*)?[A-Z0-9]{0,10}?\d{3,}\b/i;

  return email.test(text) || phone.test(text) || aadhaar.test(text) || aadhaarPlain.test(text) || policyLike.test(text);
}

export default function SachAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [language, setLanguage] = useState<string>("auto");

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
          content: `Please keep your message under ${SACH_AI_MAX_INPUT_CHARS} characters and try again.`,
        },
      ]);
      setInput("");
      return;
    }

    if (messageCount >= SACH_AI_RATE_LIMIT) {
      setMessages((prev: Message[]) => [
        ...prev,
        userMessage,
        { role: "assistant", content: "Rate limit reached (20 messages). Please wait and try again." },
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
          content:
            "I can only answer general health insurance education. Please remove personal identifiers (Aadhaar/phone/email/policy numbers) and resend your question.",
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
          language,
          stream: false, // Changed from true to false for stability
        }),
      });

      if (!res.ok) {
        const msg = await parseError(res);
        setLastAssistantContent(msg);
        return;
      }

      // Handle non-streaming response
      const data = await res.json();
      const content = typeof data?.content === "string" ? data.content : "";
      setLastAssistantContent(content || "Sach AI is currently unavailable.");

      // success
    } catch (err: any) {
      // Error handling
      setLastAssistantContent(
        err?.message ? `Sach AI error: ${err.message}` : "Sach AI is currently unavailable."
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

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center justify-center w-14 h-14 bg-[var(--color-green-primary)] text-white rounded-full shadow-xl border border-[var(--color-green-secondary)] hover:scale-105 transition-all duration-300 hover:shadow-2xl"
          aria-label="Open Sach AI Chat"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 w-[95vw] md:w-[400px] h-[600px] max-h-[85vh] bg-white border border-[var(--color-border-main)] shadow-2xl z-50 rounded-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300 font-sans">

          {/* Header */}
          <div className="bg-[var(--color-green-primary)] p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-full text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-serif font-bold text-lg leading-none tracking-wide">Sach AI</h3>
                <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">
                  Private Policy Analyst
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} className="text-white/60 hover:text-white transition-colors" title="Clear">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors" title="Close">
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
                <p className="font-serif text-[var(--color-text-main)] text-xl mb-2 font-bold">How can I help?</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
                  Ask about exclusions, limits, or jargon.
                </p>

                {!hasPolicy && (
                  <div className="w-full mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
                    <p className="text-xs font-semibold text-amber-700 mb-1">No policy loaded</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      For specific analysis,{" "}
                      <a href="/policychecker" className="underline font-medium">upload a policy first</a>.
                      I can still answer general insurance questions.
                    </p>
                  </div>
                )}

                <div className="w-full space-y-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs p-3 bg-white border border-[var(--color-border-light)] hover:border-[var(--color-green-primary)] rounded-lg transition-colors text-[var(--color-text-secondary)] shadow-sm"
                    >
                      {q}
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
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-[var(--color-border-light)] shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Language
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading}
                className="flex-1 min-w-0 py-2 px-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-cream-main)] text-xs text-[var(--color-text-main)] focus:border-[var(--color-green-primary)] outline-none"
                aria-label="Select language"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type your question..."
                className="w-full pl-4 pr-12 py-3 bg-[var(--color-cream-main)] border border-[var(--color-border-light)] focus:border-[var(--color-green-primary)] rounded-lg outline-none text-sm transition-all placeholder:text-[var(--color-text-muted)] text-[var(--color-text-main)]"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="absolute right-2 p-1.5 bg-[var(--color-green-primary)] text-white rounded-md hover:bg-[var(--color-green-secondary)] transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-2 font-mono uppercase tracking-wider">
              AI generated • Verify with policy
            </p>
          </div>
        </div>
      )}
    </>
  );
}
