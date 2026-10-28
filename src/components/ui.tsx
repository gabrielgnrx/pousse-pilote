"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Un instant…",
  className = "btn-primary w-full",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[20px] bg-pollen-pale px-4 py-3 text-sm font-semibold text-alerte">
      {message}
    </p>
  );
}
