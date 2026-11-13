import { Suspense } from "react";
import { ReadingListSections } from "./reading-list-sections";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <h1 className="text-3xl font-bold">Lista de leitura</h1>
      <Suspense fallback={<p>Carregando…</p>}>
        <ReadingListSections />
      </Suspense>
    </main>
  );
}
