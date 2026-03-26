export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">Sign In to IndSure</h1>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="mt-1 w-full rounded-md border p-2" type="email" placeholder="agent@indsure.com" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input className="mt-1 w-full rounded-md border p-2" type="password" />
          </div>
          <button className="w-full rounded-md bg-primary p-2 text-primary-foreground">Sign In</button>
        </form>
      </div>
    </div>
  );
}
