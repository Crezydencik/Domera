import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/shared/providers/AuthProvider";
import { ToastProvider } from "@/shared/providers/ToastProvider";
import { LanguageProvider } from "@/shared/providers/LanguageProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Domera - SaaS platforma māju pārvaldībai",
  description: "Mākoņdatošanas platforma daudzdzīvokļu māju pārvaldībai",
  keywords: "māju pārvaldība, komunālie pakalpojumi, dzīvokļi, skaitītāji",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lv">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <LanguageProvider>
            {children}
            <ToastProvider />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
