/**
 * The Portuguese failure messages, the only source of them. Kept free of server imports
 * so client components can share the same text.
 */
export const MESSAGES = {
  loadFailed: "Não foi possível carregar a lista de leitura.",
  saveFailed: "Não foi possível salvar. Tente novamente.",
  titleRequired: "Informe o título.",
  titleTooLong: "O título deve ter no máximo 200 caracteres.",
  authorshipRequired: "Informe a autoria.",
  authorshipTooLong: "A autoria deve ter no máximo 200 caracteres.",
  invalidStatus: "Situação inválida.",
  notFound: "Livro não encontrado.",
} as const;
