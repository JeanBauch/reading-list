"use client";

import { useEffect, useRef, useState } from "react";
import type { Book } from "@/reading-list/reading-list";
import { editBook } from "./actions";
import {
  BUTTON_CLASS,
  errorProps,
  Field,
  INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "./form-ui";
import { StatusControl } from "./status-control";
import { useFormAction } from "./use-form-action";

/** One Livro in its section: its Título and Autoria, and the controls that act on it. */
export function BookItem({ book }: { book: Book }) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function closeEdit() {
    returnFocus.current = true;
    setEditing(false);
  }

  if (editing) return <EditForm book={book} onClose={closeEdit} />;

  return (
    <>
      <p className="font-medium">{book.title}</p>
      <p className="text-zinc-600">{book.authorship}</p>
      <StatusControl book={book} />
      <div className="flex flex-wrap gap-2">
        <button
          ref={editButton}
          type="button"
          aria-label={`Editar ${book.title}`}
          onClick={() => setEditing(true)}
          className={SECONDARY_BUTTON_CLASS}
        >
          Editar
        </button>
      </div>
    </>
  );
}

type EditFailure = Extract<
  Awaited<ReturnType<typeof editBook>>,
  { ok: false }
>["error"];

/** Inline edit of Título and Autoria, with the same rules and messages as registering. */
function EditForm({ book, onClose }: { book: Book; onClose: () => void }) {
  const titleId = `edit-${book.id}-title`;
  const authorshipId = `edit-${book.id}-authorship`;
  const [failure, setFailure] = useState<EditFailure | null>(null);
  const { pending, handleSubmit } = useFormAction(editBook, (result) => {
    if (result.ok) {
      onClose();
      return;
    }
    setFailure(result.error);
    if (result.error.kind === "validation") {
      const errors = result.error.fieldErrors;
      const firstInvalid = errors.title ? titleId : authorshipId;
      document.getElementById(firstInvalid)?.focus();
    }
  });
  const fieldErrors = failure?.kind === "validation" ? failure.fieldErrors : {};

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label={`Editar ${book.title}`}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={book.id} />
      <Field id={titleId} label="Título" error={fieldErrors.title}>
        <input
          id={titleId}
          name="title"
          type="text"
          autoComplete="off"
          autoFocus
          defaultValue={book.title}
          {...errorProps(titleId, fieldErrors.title)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field id={authorshipId} label="Autoria" error={fieldErrors.authorship}>
        <input
          id={authorshipId}
          name="authorship"
          type="text"
          autoComplete="off"
          defaultValue={book.authorship}
          {...errorProps(authorshipId, fieldErrors.authorship)}
          className={INPUT_CLASS}
        />
      </Field>
      {failure && failure.kind !== "validation" && (
        <p role="alert" className="text-sm text-red-700">
          {failure.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={BUTTON_CLASS}>
          Salvar
        </button>
        <button
          type="button"
          onClick={onClose}
          className={SECONDARY_BUTTON_CLASS}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
