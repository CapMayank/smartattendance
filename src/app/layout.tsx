import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/shell/AppShell";
import { getShellData } from "@/lib/shell-data";
import { Toaster } from 'sonner';

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "SEHSS Lakhnadon | Attendance Dashboard",
  description: "Attendance management dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = await getShellData();
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body
        className={`bg-ground text-text font-sans min-h-screen antialiased`}
      >
        <Providers>
          <div className="relative min-h-screen">
            <AppShell shell={shell}>{children}</AppShell>
            <Toaster 
              theme="dark" 
              style={
                {
                  '--normal-bg': 'var(--color-card-hi)',
                  '--normal-border': 'var(--color-line)',
                  '--normal-text': 'var(--color-text)',
                  '--success-bg': 'var(--color-card-hi)',
                  '--success-border': 'var(--color-line)',
                  '--success-text': 'var(--color-text)',
                  '--error-bg': 'var(--color-card-hi)',
                  '--error-border': 'var(--color-line)',
                  '--error-text': 'var(--color-text)',
                } as React.CSSProperties
              }
              toastOptions={{ className: 'shadow-none' }}
            />
          </div>
        </Providers>
      </body>
    </html>
  );
}
