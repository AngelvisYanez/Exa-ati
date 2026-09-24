"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileText, MessageSquare, Bell, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/configuracion", label: "Ajustes", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 px-2 rounded-lg transition-colors duration-150 ${
                active
                  ? "text-brand-red"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className={`shrink-0 flex items-center justify-center size-7 rounded-md ${active ? "bg-brand-red-subtle" : ""}`}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
              </span>
              <span className={`text-[10px] truncate max-w-full ${
                active ? "font-bold" : "font-medium"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
