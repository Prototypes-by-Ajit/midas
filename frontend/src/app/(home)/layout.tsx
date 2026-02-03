import Header from "@/components/header";
import Footer from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingProvider } from "@/contexts/loading-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LoadingProvider>
      {/* Animated Theme Toggle */}
      <ThemeToggle />

      <Header />

      <main className="pt-24 pb-8">
        {children}
      </main>

      <Footer/>
    </LoadingProvider>
  );
}
