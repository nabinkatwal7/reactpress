import Link from "next/link";
import { PageForm } from "../page-form";

export default function NewPagePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/admin/pages" className="text-sm text-neutral-500 hover:underline">
          ← Pages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add page</h1>
      </div>
      <PageForm mode="create" />
    </main>
  );
}
