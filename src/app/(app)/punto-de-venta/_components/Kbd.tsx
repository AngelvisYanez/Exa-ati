import { cn } from "@/lib/utils";

export default function Kbd({ children, tone = "light", className }: {
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 font-sans text-[10px] font-semibold leading-none",
        tone === "light"
          ? "border-pos-line-strong bg-white text-pos-muted"
          : "border-white/40 bg-white/10 text-white",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
