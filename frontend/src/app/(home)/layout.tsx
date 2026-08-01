import Header from "@/components/header";
import Footer from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * No route segment config: the (home) routes are static.
 * No LoadingProvider either — components/providers.tsx already mounts one at
 * the root, and LoadingPage renders `fixed inset-0`, so a second nested
 * instance changed nothing visually.
 */
export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Animated Theme Toggle */}
      <ThemeToggle />

      <Header />

      <main className="pt-24 pb-8">{children}</main>

      <Footer />
    </>
  );
}
