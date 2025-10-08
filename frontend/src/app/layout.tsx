import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MIDAS Medical",
  description: "Advanced Medical Information and Data Analysis System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}