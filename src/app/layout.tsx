import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

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
      <body
        className={`${inter.className} bg-[#080A10] text-slate-200 min-h-screen antialiased`}
      >
        <Providers>
          <div className="relative min-h-screen">
            {/* Subtle background — single faint radial bloom */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-[#080A10]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] rounded-full bg-blue-950/30 blur-[200px] opacity-40" />
            </div>
            
            <Navbar />
            <main className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 pt-24 pb-12 sm:pt-28">
              {children}
            </main>
            <Toaster 
              theme="dark" 
              toastOptions={{ 
                className: 'bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.08] text-slate-200 shadow-2xl',
              }} 
            />
          </div>
        </Providers>
      </body>
    </html>
  );
}
