import { connection } from "next/server";
import { readingList } from "@/reading-list/instance";
import { SECTION_TEXT, sectionHeadingId } from "./labels";
import { StatusControl } from "./status-control";

/** The four sections of the Lista de leitura, read from the database on every request. */
export async function ReadingListSections() {
  // node:sqlite is synchronous: without this the query would run during prerendering at build time.
  await connection();
  const sections = readingList.getSections();

  if (!sections.ok) {
    return (
      <p
        role="alert"
        className="rounded border border-red-300 p-4 text-red-800"
      >
        {sections.error.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.value.map(({ status, books }) => {
        const text = SECTION_TEXT[status];
        const headingId = sectionHeadingId(status);
        return (
          <section key={status} aria-labelledby={headingId}>
            <h2
              id={headingId}
              tabIndex={-1}
              className="mb-2 text-xl font-semibold"
            >
              {text.heading}
            </h2>
            {books.length === 0 ? (
              <p className="text-zinc-600">{text.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {books.map((book) => (
                  <li
                    key={book.id}
                    className="flex flex-col gap-2 rounded border p-3"
                  >
                    <p className="font-medium">{book.title}</p>
                    <p className="text-zinc-600">{book.authorship}</p>
                    <StatusControl book={book} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
