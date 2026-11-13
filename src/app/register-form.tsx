"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { registerBook } from "./actions";
import { STATUS_LABELS, STATUS_OPTIONS } from "./labels";

type RegisterFailure = Extract<
  Awaited<ReturnType<typeof registerBook>>,
  { ok: false }
>["error"];

const FIELD_IDS = {
  title: "register-title",
  authorship: "register-authorship",
  status: "register-status",
} as const;

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<RegisterFailure | null>(null);
  // Blocks a second submission before the disabled button has re-rendered (double click).
  const submitting = useRef(false);

  const fieldErrors = failure?.kind === "validation" ? failure.fieldErrors : {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await registerBook(formData);
        if (result.ok) {
          setFailure(null);
          form.reset();
          document.getElementById(FIELD_IDS.title)?.focus();
          return;
        }
        setFailure(result.error);
        if (result.error.kind === "validation") {
          const errors = result.error.fieldErrors;
          const firstInvalid = (
            ["title", "authorship", "status"] as const
          ).find((field) => errors[field]);
          if (firstInvalid) {
            document.getElementById(FIELD_IDS[firstInvalid])?.focus();
          }
        }
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Cadastrar livro"
      className="flex flex-col gap-4 rounded border p-4"
    >
      <Field id={FIELD_IDS.title} label="Título" error={fieldErrors.title}>
        <input
          id={FIELD_IDS.title}
          name="title"
          type="text"
          autoComplete="off"
          {...errorProps(FIELD_IDS.title, fieldErrors.title)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field
        id={FIELD_IDS.authorship}
        label="Autoria"
        error={fieldErrors.authorship}
      >
        <input
          id={FIELD_IDS.authorship}
          name="authorship"
          type="text"
          autoComplete="off"
          {...errorProps(FIELD_IDS.authorship, fieldErrors.authorship)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field id={FIELD_IDS.status} label="Situação" error={fieldErrors.status}>
        <select
          id={FIELD_IDS.status}
          name="status"
          defaultValue="want_to_read"
          {...errorProps(FIELD_IDS.status, fieldErrors.status)}
          className={INPUT_CLASS}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>
      {failure?.kind === "storage" && (
        <p role="alert" className="text-red-700">
          {failure.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        Cadastrar
      </button>
    </form>
  );
}

export const INPUT_CLASS =
  "rounded border border-zinc-400 px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-invalid:border-red-600";

export const BUTTON_CLASS =
  "self-start rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900";

function errorProps(id: string, error: string | undefined) {
  return error
    ? { "aria-invalid": true, "aria-describedby": `${id}-error` }
    : {};
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: React.ReactNode;
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
