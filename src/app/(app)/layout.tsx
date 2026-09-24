import { Suspense } from "react";
import LayoutShell from "@/components/layout/LayoutShell";
import SriConnectDialog from "@/components/modals/SriConnectDialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutShell>
      {children}
      <Suspense fallback={null}>
        <SriConnectDialog />
      </Suspense>
    </LayoutShell>
  );
}
