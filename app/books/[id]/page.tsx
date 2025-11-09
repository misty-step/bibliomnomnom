import { PublicBookView } from "@/components/book/PublicBookView";
import type { Id } from "@/convex/_generated/dataModel";

type Params = {
  params: {
    id: string;
  };
};

export default function PublicBookPage({ params }: Params) {
  return <PublicBookView bookId={params.id as Id<"books">} />;
}
