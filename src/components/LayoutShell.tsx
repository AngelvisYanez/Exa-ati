"use client";

import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { useSidebar } from "@/contexts/SidebarContext";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen flex text-brand-gray-800 bg-brand-gray-50 dark:bg-brand-gray-800">
      <Sidebar />
      <div
        id="main-content"
        className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-200 ease-in-out
          ${collapsed ? "md:pl-14" : "md:pl-60"} pl-0 pb-14 md:pb-0`}
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
