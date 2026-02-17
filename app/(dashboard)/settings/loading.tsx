import { PageContainer } from "@/components/layout/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { Loader2 } from "lucide-react";

export default function SettingsLoading() {
  return (
    <PageContainer>
      <section className="mx-auto max-w-2xl space-y-8">
        <div>
          <div className="h-9 w-32 animate-pulse rounded bg-text-ink/10 dark:bg-text-ink/20" />
          <div className="mt-2 h-5 w-64 animate-pulse rounded bg-text-ink/5 dark:bg-text-ink/10" />
        </div>

        <div className="space-y-4">
          <div className="h-7 w-36 animate-pulse rounded bg-text-ink/10 dark:bg-text-ink/20" />
          <Surface elevation="raised" padding="lg">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-text-inkMuted" />
            </div>
          </Surface>
        </div>
      </section>
    </PageContainer>
  );
}
