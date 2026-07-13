import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saba EBM yawe · ebm.rw",
  description:
    "Global QR (GQ) — neutral national rail for self-service EBM invoicing in Rwanda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="rw">
      <body className="antialiased">{children}</body>
    </html>
  );
}
