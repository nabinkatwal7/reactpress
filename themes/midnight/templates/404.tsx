import { SiteLink } from "@/components/public/site-link";
import { Shell } from "../layout";

export default function NotFound() {
  return (
    <Shell>
      <h1 className="text-4xl font-bold tracking-tight">Lost in the dark</h1>
      <p>That page does not exist.</p>
      <SiteLink href="/" className="underline">
        Back to the homepage
      </SiteLink>
    </Shell>
  );
}
