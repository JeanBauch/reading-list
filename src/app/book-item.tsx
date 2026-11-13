"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Book } from "@/reading-list/reading-list";
import { editBook, removeBook } from "./actions";
import {
  BUTTON_CLASS,
  DANGER_BUTTON_CLASS,
  errorProps,
  Field,
  INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "./form-ui";
import { StatusControl } from "./status-control";
import { useFormAction } from "./use-form-action";

type Mode = "view" | "editing" | "confirming-removal";

/** One Livro in its section: its Título and Autoria, and the controls that act on it. */
export function BookItem({ book }: { book: Book }) {
  const [mode, setMode] = useState<Mode>("view");
  const editButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  // The button to focus once the edit form or the removal confirmation has closed.
  const returnFocusTo = useRef<typeof editButton | null>(null);

  useEffect(() => {
    if (mode === "view" && returnFocusTo.current) {
      returnFocusTo.current.current?.focus();
      returnFocusTo.current = null;
    }
  }, [mode]);

  function backToView(focus: typeof editButton) {
    returnFocusTo.current = focus;
    setMode("view");
  }

  if (mode === "editing") {
    return <EditForm book={book} onClose={() => backToView(editButton)} />;
  }

  return (
    <>
      <p className="font-medium">{book.title}</p>
      <p className="text-zinc-600">{book.authorship}</p>
      <StatusControl book={book} />
      {mode === "confirming-removal" ? (
        <RemovalConfirmation
          book={book}
          onCancel={() => backToView(removeButton)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            ref={editButton}
            type="button"
            aria-label={`Editar ${book.title}`}
            onClick={() => setMode("editing")}
            className={SECONDARY_BUTTON_CLASS}
          >
            Editar
          </button>
          <button
            ref={removeButton}
            type="button"
            aria-label={`Excluir ${book.title}`}
            onClick={() => setMode("confirming-removal")}
            className={SECONDARY_BUTTON_CLASS}
          >
            Excluir
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Where focus goes after a Livro is removed: the next Livro in its section, else the
 * previous one, else the section heading. Worked out before removing, while the Livro
 * is still in the page.
 */
function focusTargetAfterRemoval(form: HTMLFormElement): HTMLElement | null {
  const item = form.closest("li");
  const neighbour = item?.nextElementSibling ?? item?.previousElementSibling;
  if (neighbour instanceof HTMLElement) return neighbour;
  return form.closest("section")?.querySelector("h2") ?? null;
}

/** "Confirmar exclusão" / "Cancelar", shown next to the Livro instead of a native dialog. */
function RemovalConfirmation({
  book,
  onCancel,
}: {
  book: Book;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const focusAfter = useRef<HTMLElement | null>(null);
  const { pending, handleSubmit } = useFormAction(removeBook, (result) => {
    if (result.ok) {
      focusAfter.current?.focus();
      return;
    }
    setError(result.error.message);
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    focusAfter.current = focusTargetAfterRemoval(event.currentTarget);
    handleSubmit(event);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={`Excluir ${book.title}`}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={book.id} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className={DANGER_BUTTON_CLASS}
        >
          Confirmar exclusão
        </button>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className={SECONDARY_BUTTON_CLASS}
        >
          Cancelar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
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
