"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Input, Modal, Card, CardContent } from "@/components/ui";
import { RefreshCw, Trash2 } from "lucide-react";

type Agent = {
  id: string;
  full_name: string | null;
  email: string;
  city: string | null;
  created_at: string;
  policies_count: number;
  analyses_count: number;
  credits_remaining: number;
};

type IncompleteUser = {
  id: string;
  email: string;
  created_at: string;
};

export default function AgentsClient({
  agents,
  incompleteUsers,
}: {
  agents: Agent[];
  incompleteUsers: IncompleteUser[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Agent | null>(null);
  const [modalType, setModalType] = useState<"credits" | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = agents.filter(
    (a) =>
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.city?.toLowerCase().includes(search.toLowerCase())
  );

  function openModal(agent: Agent) {
    setSelected(agent);
    setModalType("credits");
    setValue(String(agent.credits_remaining));
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(value) }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSelected(null);
      setModalType(null);
      router.refresh();
    } catch (err) {
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      alert("Failed to delete user. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
          <p className="text-sm text-slate-500 mt-1">{agents.length} total agents</p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <Input
        placeholder="Search by name, email or city…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Agent</th>
                  <th className="px-5 py-3 font-medium text-slate-500">City</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Policies</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Analyses</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Credits</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Joined</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{agent.full_name || "—"}</div>
                      <div className="text-xs text-slate-400">{agent.email}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{agent.city || "—"}</td>
                    <td className="px-5 py-4">
                      <Badge variant="blue">{agent.policies_count}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="blue">{agent.analyses_count}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={agent.credits_remaining > 0 ? "green" : "red"}>
                        {agent.credits_remaining}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(agent.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={() => openModal(agent)}
                        >
                          Credits
                        </Button>
                        <button
                          onClick={() => setDeleteTarget(agent)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      No agents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {incompleteUsers.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b bg-amber-50">
              <h2 className="text-sm font-semibold text-amber-700">
                Incomplete Signups ({incompleteUsers.length}) — in Supabase Auth but never finished registration
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Email</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Created</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {incompleteUsers.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-700">{u.email}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setDeleteTarget({ id: u.id, email: u.email, full_name: null, city: null, created_at: u.created_at, policies_count: 0, analyses_count: 0, credits_remaining: 0 })}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal
        open={!!selected && !!modalType}
        onClose={() => { setSelected(null); setModalType(null); }}
        title={`Set Credits — ${selected?.full_name || selected?.email}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Credits Balance
            </label>
            <Input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter number"
            />
            <p className="mt-1 text-xs text-slate-400">Current: {selected?.credits_remaining ?? 0} credits</p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => { setSelected(null); setModalType(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-900">{deleteTarget?.full_name || deleteTarget?.email}</span>?
            This will remove them from Supabase Auth and all their data. This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
