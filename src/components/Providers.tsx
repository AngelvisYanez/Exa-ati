"use client";

import { type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="bottom-right" />
      </AuthProvider>
    </SidebarProvider>
  );
}
