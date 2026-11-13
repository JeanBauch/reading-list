"use client";

import { useState } from "react";
import { registerBook } from "./actions";
import { BUTTON_CLASS, errorProps, Field, INPUT_CLASS } from "./form-ui";
import { STATUS_LABELS, STATUS_OPTIONS } from "./labels";
import { useFormAction } from "./use-form-action";

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
  const [failure, setFailure] = useState<RegisterFailure | null>(null);
  const { pending, handleSubmit } = useFormAction(
    registerBook,
    (result, form) => {
      if (result.ok) {
        setFailure(null);
        form.reset();
        document.getElementById(FIELD_IDS.title)?.focus();
        return;
      }
      setFailure(result.error);
      if (result.error.kind === "validation") {
        const errors = result.error.fieldErrors;
        const firstInvalid = (["title", "authorship", "status"] as const).find(
          (field) => errors[field],
        );
        if (firstInvalid) {
          document.getElementById(FIELD_IDS[firstInvalid])?.focus();
        }
      }
    },
  );

  const fieldErrors = failure?.kind === "validation" ? failure.fieldErrors : {};

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
