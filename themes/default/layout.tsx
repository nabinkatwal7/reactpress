import { Suspense } from "react";
import { WidgetArea } from "@/components/widget-area";

/** Main column plus optional widget sidebar. */
export function Content({ children, sidebar = true }: { children: React.ReactNode; sidebar?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      {sidebar ? (
        <div className="w-full shrink-0 md:w-64">
          <Suspense fallback={null}>
            <WidgetArea area="sidebar" />
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}
