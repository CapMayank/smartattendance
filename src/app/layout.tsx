import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";

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
        className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen antialiased`}
      >
        <Providers>
          <div className="relative min-h-screen">
            {/* Liquid Glass Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#020205]">
              <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[140px]"></div>
              <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[140px]"></div>
              <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-cyan-900/15 blur-[140px]"></div>
              <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[140px]"></div>
            </div>
            
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
