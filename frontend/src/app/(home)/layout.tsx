"use client";

// import type { Metadata } from "next";
import "../globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingProvider } from "@/contexts/loading-context";

// Note: metadata export needs to be moved to a separate file when using "use client"
// export const metadata: Metadata = {
//   title: "MIDAS intellisense dermatology app",
//   description: "Developers : Ajitkumar Senthil kumar & ManojMaheshwar Jagadeesan",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:`
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && systemDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen relative antialiased transition-colors duration-300">
        <LoadingProvider>
          {/* Animated Theme Toggle */}
          <ThemeToggle />

          <Header />

          <main className="pt-24 pb-8">
            {children}
          </main>

          <Footer/>
        </LoadingProvider>
      </body>
    </html>
  );
}
