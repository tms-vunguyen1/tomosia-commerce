import type { ButtonHTMLAttributes, ReactNode } from "react";
import DynamicIcon from "@/helpers/DynamicIcon";

/** `primary` is the ink button; `accent` is reserved for approvals. Ported from web-shared/ui.tsx. */
export default function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: {
  variant?: "primary" | "secondary" | "accent";
  size?: "sm" | "md";
  icon?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-(--ink) text-(--surface) shadow-(--shadow-sm) hover:brightness-110",
    secondary: "border border-(--line-strong) bg-(--card) text-(--ink) hover:bg-(--ground)",
    accent: "bg-(--accent-strong) text-(--on-accent) shadow-(--shadow-sm) hover:brightness-95",
  };
  const sizes = { sm: "px-3 py-[6px] text-[13px] rounded-[9px]", md: "px-3.5 py-2 text-[13.5px] rounded-[10px]" };
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon ? <DynamicIcon icon={icon} className={size === "sm" ? "text-[15px]" : "text-[16px]"} /> : null}
      {children}
    </button>
  );
}
