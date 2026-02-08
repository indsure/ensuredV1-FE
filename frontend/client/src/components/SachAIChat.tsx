import { useState, useRef, useEffect } from "react";
import { useAnalysis } from "@/hooks/use-analysis";
import { getApiBase } from "@/lib/api";
import { Send, X, Trash2, Bot, Sparkles, Loader2 } from "lucide-react";

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

export default function SachAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const { currentJobId } = useAnalysis();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendMessage(text?: string) {
    const messageText = text ?? input;
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: "user", content: messageText };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch(`${getApiBase()}/api/sach-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          jobId: currentJobId,
        }),
      });

      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      setIsTyping(false);
      setMessages((prev: Message[]) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          setMessages((prev: Message[]) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: assistantText };
            return copy;
          });
        }
        if (done) break;
      }
    } catch (err) {
      console.error("Chat error:", err);
      setIsTyping(false);
      setMessages((prev: Message[]) => [...prev, { role: "assistant", content: "Sach AI is currently unavailable." }]);
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
                <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wide mb-8">
                  Ask about exclusions, limits, or jargon.
                </p>

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
