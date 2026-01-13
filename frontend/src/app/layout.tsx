import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/components/providers'
import './globals.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MIDAS intellisense dermatology app",
  description: "Developers : Ajitkumar Senthil kumar & ManojMaheshwar Jagadeesan",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('theme');
                    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (theme === 'dark' || (!theme && systemDark)) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } catch (e) {
                    document.documentElement.classList.remove('dark');
                  }
                })();
              `,
            }}
          />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased transition-colors duration-300`} suppressHydrationWarning>
          <Providers>
            {children}
            <Toaster richColors position="top-right" />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
