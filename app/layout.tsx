import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";

export const metadata: Metadata = {
  title: "Ashes Connect — Get a US phone number. Call, text, and WhatsApp.",
  description:
    "Get a real US phone number from anywhere in the world. Make and receive calls from your browser, send and receive SMS, and connect WhatsApp — all live, all in one dashboard.",
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
