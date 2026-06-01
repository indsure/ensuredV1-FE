"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import { Plus, Copy, Check } from "lucide-react";

type Code = {
  code: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  used_by_name: string | null;
};

export default function InviteCodesClient({ codes }: { codes: Code[] }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const used = codes.filter((c) => c.used_by);
  const unused = codes.filter((c) => !c.used_by);

  async function generateCode() {
    setGenerating(true);
    try {
      const res = await fetch("/api/invite-codes", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      alert("Failed to generate code. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invite Codes</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unused.length} unused · {used.length} used · {codes.length} total
          </p>
        </div>
        <Button onClick={generateCode} disabled={generating} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {generating ? "Generating…" : "Generate Code"}
        </Button>
      </div>

      {unused.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Available Codes ({unused.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Code</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Created</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Copy</th>
                </tr>
              </thead>
              <tbody>
                {unused.map((c) => (
                  <tr key={c.code} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-800">{c.code}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="green">Available</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => copyCode(c.code)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copy code"
                      >
                        {copied === c.code ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {used.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Used Codes ({used.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Code</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Used By</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Used On</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {used.map((c) => (
                  <tr key={c.code} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-slate-500">{c.code}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{c.used_by_name ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {c.used_at
                        ? new Date(c.used_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="default">Used</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {codes.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Ticket className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No invite codes yet. Generate your first one above.</p>
        </div>
      )}
    </div>
  );
}

function Ticket({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}
