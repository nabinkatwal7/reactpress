import { PageHeader } from "@/components/admin/page-header";
import Link from "next/link";
import { PageForm } from "../page-form";

export default function NewPagePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader back={{ href: "/admin/pages", label: "Pages" }} title="Add page" />
      <PageForm mode="create" />
    </main>
  );
}
