import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulk Promotional Email Dashboard",
  description: "Internal dashboard for imports, contacts, and campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
