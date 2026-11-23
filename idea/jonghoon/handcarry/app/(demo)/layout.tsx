import { Suspense } from "react";
import { PresenterShell } from "@/components/shell/presenter-shell";
import { DemoProvider } from "@/lib/store/react";

// Everything under the demo shell is client state, so one Suspense boundary covers the
// URL hooks (usePathname/useParams) that suspend on dynamic routes with Cache Components.
export default function DemoLayout({ children }: LayoutProps<"/">) {
  return (
    <DemoProvider>
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <PresenterShell>{children}</PresenterShell>
      </Suspense>
    </DemoProvider>
  );
}
