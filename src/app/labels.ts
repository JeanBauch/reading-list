import type { Status } from "@/reading-list/reading-list";

/** Portuguese names of each Situação, as shown in the interface. */
export const STATUS_LABELS: Record<Status, string> = {
  want_to_read: "Quero ler",
  reading: "Lendo",
  read: "Lido",
  abandoned: "Abandonado",
};

/** Heading and empty-state message of the section that holds each Situação. */
export const SECTION_TEXT: Record<Status, { heading: string; empty: string }> =
  {
    reading: { heading: "Lendo", empty: "Nenhum livro em Lendo." },
    want_to_read: { heading: "Fila", empty: "Nenhum livro na Fila." },
    read: { heading: "Lido", empty: "Nenhum livro em Lido." },
    abandoned: { heading: "Abandonado", empty: "Nenhum livro em Abandonado." },
  };

export function sectionHeadingId(status: Status): string {
  return `section-${status}`;
}
