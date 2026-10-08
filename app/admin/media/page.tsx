import { isImage, listMedia, mediaUrl } from "@/lib/media";
import { requireSiteId } from "@/lib/site";
import { deleteMediaAction } from "./actions";
import { UploadForm } from "./upload-form";

export const instant = false;

export default async function MediaPage() {
  const items = await listMedia(await requireSiteId());

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
      </div>

      <UploadForm />

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">No media yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 border border-neutral-200 p-2 text-sm">
              <a href={mediaUrl(m.path)} target="_blank" rel="noreferrer">
                {isImage(m.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(m.path)}
                    alt={m.altText}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-neutral-100 text-neutral-500">
                    {m.mimeType}
                  </div>
                )}
              </a>
              <p className="truncate font-medium">{m.filename}</p>
              <p className="text-neutral-500">{Math.ceil(m.size / 1024)} KB</p>
              <form action={deleteMediaAction.bind(null, m.id)}>
                <button type="submit" className="text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
