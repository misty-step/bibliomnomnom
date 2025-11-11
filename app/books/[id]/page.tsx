import { PublicBookView } from "@/components/book/PublicBookView";
import type { Id } from "@/convex/_generated/dataModel";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PublicBookPage({ params }: Params) {
  const { id } = await params;
  return <PublicBookView bookId={id as Id<"books">} />;
}
