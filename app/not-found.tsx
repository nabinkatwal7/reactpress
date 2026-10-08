import { renderNotFound } from "@/lib/theme/render";
import { Suspense } from "react";

async function ThemedNotFound() {
  return renderNotFound();
}

// Rendered inside Suspense so the shell can prerender while the theme loads per request.
export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <ThemedNotFound />
    </Suspense>
  );
}
