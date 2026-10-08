import Link from "next/link";
import { Content } from "../layout";
import { SearchForm } from "@/components/public/parts";

export default function NotFound() {
  return (
    <Content sidebar={false}>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <SearchForm />
      <Link href="/" className="underline">
        Back to the homepage
      </Link>
    </Content>
  );
}
