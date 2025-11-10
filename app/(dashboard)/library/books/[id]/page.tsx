import { BookDetail } from "@/components/book/BookDetail";
import type { Id } from "@/convex/_generated/dataModel";

type Params = {
  params: {
    id: string;
  };
};

export default function BookDetailPage({ params }: Params) {
  return <BookDetail bookId={params.id as Id<"books">} />;
}
