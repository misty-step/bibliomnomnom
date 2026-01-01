import { BookDetail } from "@/components/book/BookDetail";
import { PageContainer } from "@/components/layout/PageContainer";
import type { Id } from "@/convex/_generated/dataModel";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BookDetailPage({ params }: Params) {
  const { id } = await params;
  return (
    <PageContainer>
      <BookDetail bookId={id as Id<"books">} />
    </PageContainer>
  );
}
