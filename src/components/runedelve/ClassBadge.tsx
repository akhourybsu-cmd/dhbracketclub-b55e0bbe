import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import { cn } from "@/lib/utils";
import { RuneHeroArt } from "./RuneArtwork";

export function ClassBadge({
  cls,
  size = "md",
}: {
  cls: HeroClass;
  size?: "sm" | "md" | "lg";
}) {
  const def = getClass(cls);
  const sizes = {
    sm: "w-6 h-6 text-sm",
    md: "w-8 h-8 text-base",
    lg: "w-12 h-12 text-2xl",
  };
  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden",
        sizes[size],
      )}
      style={{
        background: `linear-gradient(135deg, hsl(var(--${def.color}) / 0.25), hsl(var(--${def.color}) / 0.05))`,
        border: `1px solid hsl(var(--${def.color}) / 0.35)`,
      }}
      title={def.name}
    >
      <RuneHeroArt cls={cls} />
    </div>
  );
}
