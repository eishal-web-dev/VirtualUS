import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-black/35",
        "focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-black/20",
        "disabled:bg-black/[.03] disabled:text-black/40",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
