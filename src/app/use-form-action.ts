"use client";

import { useRef, useTransition, type FormEvent } from "react";

/** What a rejected Server Action call (network drop, server restart) looks like to callers. */
export type ConnectionFailure = {
  ok: false;
  error: { kind: "storage"; message: string };
};

const CONNECTION_FAILURE: ConnectionFailure = {
  ok: false,
  error: {
    kind: "storage",
    message: "Não foi possível salvar. Tente novamente.",
  },
};

/**
 * Submits a form to a Server Action inside a transition. While it runs, `pending` is true
 * and any further submission is ignored, even one that arrives before the disabled
 * button has re-rendered (a double click). A rejected call is reported to `onResult` as a
 * storage failure, so the page never falls back to the framework error screen.
 */
export function useFormAction<R>(
  action: (formData: FormData) => Promise<R>,
  onResult: (result: R | ConnectionFailure, form: HTMLFormElement) => void,
) {
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        let result: R | ConnectionFailure;
        try {
          result = await action(formData);
        } catch (error) {
          console.error("Server Action call failed:", error);
          result = CONNECTION_FAILURE;
        }
        onResult(result, form);
      } finally {
        submitting.current = false;
      }
    });
  }

  return { pending, handleSubmit };
}
