import { Button } from "@/components/ui";

export default function AdminLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-lg text-center">
        <h1 className="mb-2 text-2xl font-bold">IndSure Team Admin</h1>
        <p className="mb-8 text-sm text-slate-500">Sign in with your Google Workspace account.</p>
        <form>
          <Button className="w-full bg-blue-600 hover:bg-blue-700">Continue with Google</Button>
        </form>
        <p className="mt-6 text-xs text-slate-400">Requires manual approval in Supabase Dashboard.</p>
      </div>
    </div>
  );
}
