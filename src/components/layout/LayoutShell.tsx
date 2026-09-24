"use client";

import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { useSidebar } from "@/contexts/SidebarContext";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-dvh flex text-brand-gray-800 bg-brand-gray-50">
      <Sidebar />
      <div
        id="main-content"
        className={`flex-1 min-w-0 flex flex-col min-h-dvh transition-[padding] duration-200 ease-out
          ${collapsed ? "md:pl-14" : "md:pl-60"} pl-0 pb-14 md:pb-0`}
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
