/**
 * The closed set of Situações, with stable English names (shown in Portuguese by the UI).
 * Kept free of server imports so client components can share the same list.
 */
export const STATUSES = [
  "want_to_read",
  "reading",
  "read",
  "abandoned",
] as const;
export type Status = (typeof STATUSES)[number];
