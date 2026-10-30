import { cn } from "@/lib/utils";

/** Engraved metalwork that stays outside the portrait and reward silhouettes. */
export function RuneMenuSigil({ className }: { className?: string }) {
  return (
    <svg
      className={cn("rd-menu-sigil", className)}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="100"
        cy="100"
        r="91"
        stroke="currentColor"
        strokeWidth=".65"
      />
      <circle cx="100" cy="100" r="84" stroke="currentColor" strokeWidth=".5" />
      <circle cx="100" cy="100" r="69" stroke="currentColor" strokeWidth=".6" />
      {Array.from({ length: 24 }, (_, index) => (
        <path
          key={index}
          d={index % 3 === 0 ? "M100 17v10m-3-7 3-3 3 3" : "M100 19v4"}
          stroke="currentColor"
          strokeWidth=".8"
          transform={`rotate(${index * 15} 100 100)`}
        />
      ))}
      <path
        d="m100 2 5 7-5 7-5-7Zm98 98-7 5-7-5 7-5ZM100 198l-5-7 5-7 5 7ZM2 100l7-5 7 5-7 5Z"
        fill="currentColor"
      />
      <path
        d="m53 53 11 4-7 7Zm94 0-4 11-7-7Zm0 94-11-4 7-7Zm-94 0 4-11 7 7Z"
        stroke="currentColor"
        strokeWidth=".9"
      />
      <path
        d="M87 39h26m-20-4 7 8 7-8m54 52v26m4-20-8 7 8 7M87 161h26m-20 4 7-8 7 8M39 87v26m-4-20 8 7-8 7"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
