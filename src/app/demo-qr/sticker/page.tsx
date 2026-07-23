import { Suspense } from "react";
import StickerBuilderPage from "./StickerBuilderPage";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted">Loading sticker builder…</p>}>
      <StickerBuilderPage />
    </Suspense>
  );
}
