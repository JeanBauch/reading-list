"use client";

import { useState } from "react";
import type { Book } from "@/reading-list/reading-list";
import { changeBookStatus } from "./actions";
import { INPUT_CLASS, SECONDARY_BUTTON_CLASS } from "./form-ui";
import { sectionHeadingId, STATUS_LABELS, STATUS_OPTIONS } from "./labels";
import { useFormAction } from "./use-form-action";

/**
 * Situação selector plus "Mover". Only the button saves; the list changes only after the
 * server confirms, and a failure puts the selector back on the current Situação.
 */
export function StatusControl({ book }: { book: Book }) {
  const [selected, setSelected] = useState(book.status);
  const [error, setError] = useState<string | null>(null);
  const { pending, handleSubmit } = useFormAction(
    changeBookStatus,
    (result) => {
      if (result.ok) {
        setError(null);
        document.getElementById(sectionHeadingId(result.status))?.focus();
        return;
      }
      setSelected(book.status);
      setError(result.error.message);
    },
  );
  const selectId = `status-${book.id}`;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={book.id} />
      <label htmlFor={selectId} className="sr-only">
        Situação de {book.title}
      </label>
      <select
        id={selectId}
        name="status"
        value={selected}
        onChange={(event) => setSelected(event.target.value as Book["status"])}
        className={INPUT_CLASS}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        aria-label={`Mover ${book.title}`}
        className={SECONDARY_BUTTON_CLASS}
      >
        Mover
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
