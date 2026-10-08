/** Narrow centred reading column; no sidebar. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">{children}</main>
  );
}
