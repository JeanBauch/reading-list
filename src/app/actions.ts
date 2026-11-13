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
