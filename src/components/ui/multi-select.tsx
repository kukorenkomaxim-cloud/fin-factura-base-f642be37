import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  selectedLabel?: (n: number) => string;
  className?: string;
  width?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  allLabel,
  selectedLabel,
  className,
  width = "w-56",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : selectedLabel
          ? selectedLabel(selected.length)
          : `${selected.length}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(width, "justify-between font-normal", className)}
        >
          <span className="truncate">{label}</span>
          <div className="ml-2 flex items-center gap-1">
            {selected.length > 0 && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(width, "p-1")} align="start">
        <div className="max-h-72 overflow-auto">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">—</div>
          )}
          {options.map((o) => {
            const isSel = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Checkbox checked={isSel} className="pointer-events-none" />
                <span className="flex-1 truncate">{o.label}</span>
                {isSel && <Check className="h-4 w-4 opacity-70" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
