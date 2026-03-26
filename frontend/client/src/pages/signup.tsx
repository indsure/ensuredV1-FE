import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function SignupPublic() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Sign Up — IndSure";
  }, []);

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-[#0B1120]/40 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300">
            ← Back to Home
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">Agent signup</span>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Sign up is available for agents only
          </h1>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            If you are an empanelled insurance agent and want access to the agent portal, use the agent signup flow.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setLocation("/agent/signup")}
              className="px-6 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              Start Agent Signup
            </button>
            <Link
              href="/agent/login"
              className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#0F1419] transition-colors text-center"
            >
              Already an agent? Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

