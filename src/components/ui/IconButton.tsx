import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icon: LucideIcon;
  label: string;
};

export function IconButton({ icon: Icon, label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "touch-target grid size-10 place-items-center rounded-full border border-line bg-transparent text-muted transition-colors duration-150 hover:border-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
