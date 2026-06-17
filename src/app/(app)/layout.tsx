import LayoutShell from "@/components/LayoutShell";
import SriConnectDialog from "@/components/SriConnectDialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutShell>
      {children}
      <SriConnectDialog />
    </LayoutShell>
  );
}
