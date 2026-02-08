import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640

  const getVisiblePages = () => {
    if (isMobile) {
      // Mobile: Just show current page
      return [currentPage]
    }

    // Desktop: Show up to 5 pages around current
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show pages around current
      if (currentPage <= 3) {
        // Near start
        for (let i = 1; i <= maxVisible; i++) {
          pages.push(i)
        }
      } else if (currentPage >= totalPages - 2) {
        // Near end
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Middle
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pages.push(i)
        }
      }
    }

    return pages
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-10"
      >
        <ChevronLeft className="h-4 w-4" />
        {!isMobile && <span className="ml-1">Previous</span>}
      </Button>

      {!isMobile && (
        <>
          {visiblePages.map((page, index) => {
            if (typeof page === "string") return null

            return (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn(
                  "h-10 min-w-[40px]",
                  page === currentPage && "font-semibold bg-primary-500 text-white"
                )}
              >
                {page}
              </Button>
            )
          })}
        </>
      )}

      {isMobile && (
        <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
          Page {currentPage} of {totalPages}
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-10"
      >
        {!isMobile && <span className="mr-1">Next</span>}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
