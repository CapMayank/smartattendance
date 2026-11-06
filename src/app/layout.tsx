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
              toastOptions={{ 
                className: 'bg-black/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl',
              }} 
            />
          </div>
        </Providers>
      </body>
    </html>
  );
}
