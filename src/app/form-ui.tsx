import type { ReactNode } from "react";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const INPUT_CLASS = `rounded border border-zinc-400 bg-transparent px-2 py-1 aria-invalid:border-red-600 ${FOCUS_RING}`;

export const BUTTON_CLASS = `self-start rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 ${FOCUS_RING}`;

export const SECONDARY_BUTTON_CLASS = `self-start rounded border border-zinc-400 px-3 py-1 disabled:opacity-50 ${FOCUS_RING}`;

/** Links a field to its error message so screen readers announce them together. */
export function errorProps(id: string, error: string | undefined) {
  return error
    ? { "aria-invalid": true, "aria-describedby": `${id}-error` }
    : {};
}

/** A visible label, the control, and the control's error message right below it. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
