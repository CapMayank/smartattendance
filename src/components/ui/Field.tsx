import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-absent">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-subtle">{helper}</p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-[10px] border border-line bg-ground px-3 text-sm text-text placeholder:text-subtle transition-colors duration-150 hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-absent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, "h-10", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-24 py-2", className)} {...rest} />;
  },
);
