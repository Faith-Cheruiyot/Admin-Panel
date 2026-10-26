import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humor HQ — The Humor Project",
  description: "The control room for a little more laughter. Secure Humor Project administration.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
