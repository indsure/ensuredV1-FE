"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Sort options alphabetically
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a: ComboboxOption, b: ComboboxOption) => a.label.localeCompare(b.label))
  }, [options])

  const selectedOption = sortedOptions.find((option: ComboboxOption) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100", className || "h-10")}
        >
          <span className={cn("truncate", !selectedOption && "text-gray-500 dark:text-gray-400")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Command className="bg-white dark:bg-gray-800">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CommandInput
              placeholder={searchPlaceholder}
              className="bg-white dark:bg-gray-800 border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <CommandList className="bg-white dark:bg-gray-800 max-h-[120px]">
            <CommandEmpty className="bg-white dark:bg-gray-800">{emptyMessage}</CommandEmpty>
            <CommandGroup className="bg-white dark:bg-gray-800">
              {sortedOptions.map((option: ComboboxOption) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange?.(option.value === value ? "" : option.value)
                    setOpen(false)
                  }}
                  className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

