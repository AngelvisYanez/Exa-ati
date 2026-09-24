import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a OFSERCONT IA para gestionar tus obligaciones tributarias en Ecuador.",
  robots: { index: true, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-red p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-red via-brand-red-mid to-brand-red-bright" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.05),transparent_50%)]" />
      <div className="absolute top-1/4 -left-32 size-96 bg-brand-red-light/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 size-96 bg-brand-amber/5 rounded-full blur-3xl" />
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}
