"use server";

import { refresh } from "next/cache";
import { readingList } from "@/reading-list/instance";

// Thin Server Actions: they can be POSTed directly, so every rule and message comes from the
// Reading List module. Failures are passed through untouched; success refreshes the page.

export async function registerBook(formData: FormData) {
  const result = readingList.register({
    title: formData.get("title"),
    authorship: formData.get("authorship"),
    status: formData.get("status"),
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true } as const;
}

export async function changeBookStatus(formData: FormData) {
  const result = readingList.changeStatus(
    formData.get("id"),
    formData.get("status"),
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true, status: result.value.status } as const;
}

export async function editBook(formData: FormData) {
  const result = readingList.edit(formData.get("id"), {
    title: formData.get("title"),
    authorship: formData.get("authorship"),
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true } as const;
}

export async function removeBook(formData: FormData) {
  const result = readingList.remove(formData.get("id"));
  if (!result.ok) return result;
  refresh();
  return { ok: true } as const;
}
