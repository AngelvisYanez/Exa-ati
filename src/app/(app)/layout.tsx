import { Suspense } from "react";
import type { Metadata } from "next";
import LayoutShell from "@/components/layout/LayoutShell";
import SriConnectDialog from "@/components/modals/SriConnectDialog";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

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
