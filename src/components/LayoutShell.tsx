"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = (e: Event) => {
      const ce = e as CustomEvent<{ collapsed: boolean }>;
      setCollapsed(ce.detail.collapsed);
    };
    window.addEventListener("sidebar-resize", handleResize);
    return () => window.removeEventListener("sidebar-resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen flex text-brand-gray-800 bg-brand-gray-50">
      <Sidebar />
      <div
        className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-200 ease-in-out
          ${collapsed ? "md:pl-14" : "md:pl-60"} pl-0`}
      >
        {children}
      </div>
    </div>
  );
}
