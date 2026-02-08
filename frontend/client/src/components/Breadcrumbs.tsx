import { Link, useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const [location] = useLocation();

  // Auto-generate breadcrumbs from path if not provided
  const breadcrumbs: BreadcrumbItem[] = items || (() => {
    const paths = location.split("/").filter(Boolean);
    const result: BreadcrumbItem[] = [{ label: "Home", href: "/" }];

    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      result.push({
        label,
        href: index === paths.length - 1 ? undefined : currentPath,
      });
    });

    return result;
  })();

  return (
    <nav
      className={cn(
        "hidden md:flex items-center gap-2 px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
        className
      )}
      aria-label="Breadcrumb"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            {index === 0 && (
              <Link href={item.href || "/"}>
                <Home className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors" />
              </Link>
            )}
            {item.href && !isLast ? (
              <Link href={item.href}>
                <span className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  {item.label}
                </span>
              </Link>
            ) : (
              <span className={cn(
                "text-gray-900 dark:text-gray-100",
                isLast && "font-semibold"
              )}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-gray-400 mx-1" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

