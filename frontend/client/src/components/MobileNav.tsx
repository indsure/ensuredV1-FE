import { useLocation } from "wouter";
import { Link } from "wouter";
import { Home, Calculator, Scale, FileText, Upload } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { useEffect, useState } from "react";

const mobileNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/blog", label: "Blog", icon: FileText },
];

export function MobileNav() {
  const [location] = useLocation();
  const { currentJobId } = useAnalysis();
  const [hasActiveJob, setHasActiveJob] = useState(false);

  useEffect(() => {
    const jobId = currentJobId || sessionStorage.getItem("ensured_current_job");
    setHasActiveJob(!!jobId && !jobId.startsWith("legacy-"));
  }, [currentJobId]);

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  // Don't show on processing or report pages
  if (location === "/processing" || location === "/report") {
    return null;
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 transition-colors ${
                active
                  ? "text-[#1A3A52] dark:text-[#4A9B9E]"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-1" />
                {active && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#3CBBA0] rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium truncate w-full text-center">
                {item.label}
              </span>
            </Link>
          );
        })}
        {hasActiveJob && (
          <Link
            href="/processing"
            className="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 text-[#3CBBA0] animate-pulse"
            aria-label="View analysis progress"
          >
            <Upload className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Analyzing</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

