"use client";

import { useRef, useTransition, type FormEvent } from "react";

/**
 * Submits a form to a Server Action inside a transition. While it runs, `pending` is true
 * and any further submission is ignored, even one that arrives before the disabled
 * button has re-rendered (a double click).
 */
export function useFormAction<R>(
  action: (formData: FormData) => Promise<R>,
  onResult: (result: R, form: HTMLFormElement) => void,
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
        onResult(await action(formData), form);
      } finally {
        submitting.current = false;
      }
    });
  }

  return { pending, handleSubmit };
}
