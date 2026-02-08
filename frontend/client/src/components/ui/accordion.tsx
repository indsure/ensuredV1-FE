import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AccordionItem {
  question: string
  answer: string | React.ReactNode
  category?: string
}

export interface AccordionProps {
  items: AccordionItem[]
  defaultOpen?: number
  className?: string
}

export function Accordion({ items, defaultOpen, className }: AccordionProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(
    defaultOpen ?? null
  )

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
          >
            <button
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${index}`}
            >
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.question}
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-gray-500 transition-transform duration-200",
                  isOpen && "transform rotate-180"
                )}
              />
            </button>
            <div
              id={`accordion-content-${index}`}
              className={cn(
                "overflow-hidden transition-all duration-[var(--transition-normal)] [transition-timing-function:var(--ease-out)]",
                isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-400">
                {typeof item.answer === 'string' ? item.answer : item.answer}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
