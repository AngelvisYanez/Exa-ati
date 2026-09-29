import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cuenta",
  description: "Accede o crea tu cuenta en OFSERCONT IA.",
  robots: { index: true, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh flex flex-col items-stretch justify-start sm:items-center sm:justify-center overflow-x-hidden overflow-y-auto bg-brand-red px-3 py-4 sm:px-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-red via-brand-red-mid to-brand-red-bright"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden sm:block bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.05),transparent_50%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-3xl mx-auto my-auto">{children}</div>
    </div>
  );
}
