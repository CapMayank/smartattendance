import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SEHSS Lakhnadon | Attendance Dashboard",
  description: "Attendance management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-bg text-fg min-h-screen antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster
            theme="dark"
            toastOptions={{
              className: '!bg-panel !border !border-line-strong !text-fg !rounded-md',
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
