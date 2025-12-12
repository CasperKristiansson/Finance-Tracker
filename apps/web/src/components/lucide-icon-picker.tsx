import * as LucideIcons from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

type LucideEntry = { name: string; Icon: IconComponent };

const LUCIDE_PREFIX = "lucide:";

const lucideEntries: LucideEntry[] = Object.entries(LucideIcons)
  .filter(([name]) => /^[A-Z]/.test(name) && name !== "Icon")
  .map(([name, component]) => ({ name, Icon: component as IconComponent }));

export type LucideIconPickerProps = {
  value?: string | null;
  onChange: (icon: string) => void;
  maxLength?: number;
  inputId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const LucideIconPicker: React.FC<LucideIconPickerProps> = ({
  value,
  onChange,
  maxLength,
  inputId,
  placeholder = "Search icons (e.g., Wallet, PiggyBank)",
  disabled,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const current = value ?? "";
    if (current.startsWith(LUCIDE_PREFIX)) {
      setQuery(current.slice(LUCIDE_PREFIX.length));
    } else {
      setQuery("");
    }
    setOpen(false);
    setPage(0);
  }, [value]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const allowedEntries = useMemo(() => {
    if (!maxLength) return lucideEntries;
    return lucideEntries.filter(
      (entry) => `${LUCIDE_PREFIX}${entry.name}`.length <= maxLength,
    );
  }, [maxLength]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allowedEntries;
    const filtered = allowedEntries.filter((entry) =>
      entry.name.toLowerCase().includes(q),
    );
    return filtered.length ? filtered : allowedEntries;
  }, [allowedEntries, query]);

  const pageSize = 72;
  const maxPage = Math.max(0, Math.ceil(filteredEntries.length / pageSize) - 1);
  const pagedIcons = filteredEntries.slice(
    page * pageSize,
    page * pageSize + pageSize,
  );

  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={inputId}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-24"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
        >
          {open ? "Close" : "Browse"}
        </Button>
        {open ? (
          <div className="absolute z-20 mt-2 w-[420px] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
            <div className="max-h-64 overflow-y-auto">
              <div className="grid grid-cols-6 gap-2">
                {pagedIcons.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(`${LUCIDE_PREFIX}${name}`);
                      setOpen(false);
                      setQuery(name);
                    }}
                    aria-label={name}
                    title={name}
                    disabled={disabled}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
              {filteredEntries.length === 0 ? (
                <p className="p-2 text-center text-xs text-slate-500">
                  No icons match your search.
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span>
                {filteredEntries.length === 0
                  ? "0 of 0"
                  : `${page * pageSize + 1}-${Math.min(
                      filteredEntries.length,
                      (page + 1) * pageSize,
                    )} of ${filteredEntries.length}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  disabled={page >= maxPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
