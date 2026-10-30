import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/** Compact game tabs retain one keyboard stop and never open a scroller. */
export function RuneMenuTabs<const T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  panelId,
  className,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: NoInfer<T>) => void;
  panelId: string;
  className?: string;
}) {
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !options.length)
      return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const index = tabs.findIndex((tab) => tab === event.target);
    if (index < 0) return;
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    onChange(options[next].value);
    tabs[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn("rd-menu-tabs rd-fit-tabs", className)}
      onKeyDown={navigate}
    >
      {options.map((option) => (
        <button
          type="button"
          role="tab"
          key={option.value}
          id={`${id}-${option.value}`}
          aria-controls={panelId}
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
