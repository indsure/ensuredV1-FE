import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ALL_INSURERS,
  INSURERS_BY_CATEGORY,
  isKnownInsurer,
} from "@/lib/data/insurer-directory";

interface InsurerSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Rendered above the control; keep it short, this is read on a phone. */
  label?: string;
  id?: string;
}

const OTHER = "__other__";

/**
 * Search-and-select for insurer names, with a deliberate escape hatch.
 *
 * Free text let anyone invent an insurer, and the app then treated that string
 * as fact. A closed list alone is worse: an agent whose insurer is missing is
 * simply blocked. So the list is the default path and "Other" opens a text box
 * whose value is kept but marked unverified, which is what `isKnownInsurer`
 * reports to callers.
 *
 * Built for the 40+ advisor on a phone: 44px+ targets, real labels, no
 * hover-only affordances, and the group headings stay visible while filtering
 * so it is always clear whether you are looking at life, health or general.
 */
export function InsurerSelect({
  value,
  onChange,
  placeholder = "Select insurer",
  disabled = false,
  label,
  id,
}: InsurerSelectProps) {
  const [open, setOpen] = useState(false);

  // A stored value that is not in the list came from "Other" (or predates the
  // picker). Keep it, show it, and keep the free-text box open so it stays
  // editable instead of being silently swapped for a list entry.
  const [otherMode, setOtherMode] = useState(
    () => !!value && !isKnownInsurer(value),
  );

  const groups = useMemo(
    () =>
      Object.entries(INSURERS_BY_CATEGORY).filter(
        ([, list]) => list.length > 0,
      ),
    [],
  );

  const triggerText = value || placeholder;

  if (otherMode) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
            {label}
          </label>
        )}
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Insurer name"
          className="min-h-11"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            Not in our list, so we will not treat this as a verified insurer.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOtherMode(false);
              onChange("");
              setOpen(true);
            }}
            className="shrink-0 text-sm font-semibold text-[#0D9488] underline underline-offset-2 disabled:opacity-50"
          >
            Pick from list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`w-full min-h-11 justify-between border-slate-200 bg-white font-medium ${
              value ? "text-slate-900" : "text-slate-500"
            }`}
          >
            <span className="truncate">{triggerText}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command
            // cmdk's default filter is fuzzy/subsequence, so typing "tata"
            // surfaced "Star Health" and "Oriental Insurance" above the two real
            // Tata entries. An advisor scanning that list cannot tell why those
            // are there. Plain substring is predictable and it is what someone
            // typing an insurer's name expects. "Other" is pinned so a search
            // that finds nothing still leaves a way forward.
            filter={(value, search) => {
              if (value === OTHER) return 0.1;
              const q = search.trim().toLowerCase();
              if (!q) return 1;
              return value.toLowerCase().includes(q) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search insurer..." />
            <CommandList>
              <CommandEmpty>
                No insurer matches that name.
              </CommandEmpty>
              {groups.map(([category, list]) => (
                <CommandGroup key={category} heading={category}>
                  {list.map((insurer) => (
                    <CommandItem
                      key={insurer}
                      value={insurer}
                      onSelect={() => {
                        onChange(insurer);
                        setOpen(false);
                      }}
                      className="min-h-11 cursor-pointer"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 text-[#0D9488] ${
                          value === insurer ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {insurer}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandGroup heading="Not listed">
                <CommandItem
                  value={OTHER}
                  onSelect={() => {
                    setOtherMode(true);
                    setOpen(false);
                  }}
                  className="min-h-11 cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4 text-slate-500" />
                  Other (type the name)
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { ALL_INSURERS };
