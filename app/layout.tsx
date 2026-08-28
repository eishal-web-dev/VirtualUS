import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";

export const metadata: Metadata = {
  title: "Ashes Connect — Every customer conversation. One place.",
  description:
    "Phone, SMS, WhatsApp, and social DMs — plus a US business number and a lightweight CRM — in one clean dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-paper text-ink">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
