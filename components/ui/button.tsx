import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gradient";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black/80 disabled:bg-black/30 shadow-sm hover:shadow-md",
  secondary: "bg-white text-ink border border-black/10 hover:bg-black/[.03] hover:border-black/20",
  ghost: "bg-transparent text-ink hover:bg-black/[.04]",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 shadow-sm hover:shadow-md",
  gradient:
    "bg-brand-gradient text-white shadow-glow hover:brightness-110 disabled:opacity-40 disabled:shadow-none",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-5 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
