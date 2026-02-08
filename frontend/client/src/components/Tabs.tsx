import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
  scrollable?: boolean;
}

export function Tabs({
  items,
  defaultTab,
  onTabChange,
  className,
  scrollable = false,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || items[0]?.id);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useState<HTMLDivElement | null>(null)[0];
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainer) {
      const checkScroll = () => {
        setCanScrollLeft(scrollContainer.scrollLeft > 0);
        setCanScrollRight(
          scrollContainer.scrollLeft <
            scrollContainer.scrollWidth - scrollContainer.clientWidth
        );
      };

      checkScroll();
      scrollContainer.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);

      return () => {
        scrollContainer.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [scrollContainer]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainer) {
      const scrollAmount = 200;
      scrollContainer.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const activeTabContent = items.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab Navigation */}
      <div className="relative border-b border-gray-200 dark:border-gray-700">
        {scrollable && canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-0 h-12 z-10 bg-white dark:bg-gray-800"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {scrollable && canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-12 z-10 bg-white dark:bg-gray-800"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={setScrollContainer}
          className={cn(
            "flex items-center gap-1 overflow-x-auto scrollbar-hide",
            scrollable && "px-10"
          )}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 h-12 text-sm font-medium transition-colors relative",
                "hover:text-primary-500",
                activeTab === item.id
                  ? "text-primary-500"
                  : "text-gray-600 dark:text-gray-400"
              )}
            >
              {item.icon && <span className="h-4 w-4">{item.icon}</span>}
              <span>{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTabContent && (
        <div className="mt-6">{activeTabContent}</div>
      )}
    </div>
  );
}

// Hide scrollbar styles
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `;
  if (!document.head.querySelector("style[data-scrollbar-hide]")) {
    style.setAttribute("data-scrollbar-hide", "true");
    document.head.appendChild(style);
  }
}

