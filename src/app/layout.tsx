import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/shared/providers/AuthProvider";
import { ToastProvider } from "@/shared/providers/ToastProvider";
import { getLocale, getMessages } from "next-intl/server";
import { messagesWithDefault } from "../shared/lib/i18n";
import { NextIntlClientProvider } from "next-intl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Domera - SaaS платформа управления домами",
  description: "Облачная платформа для управления многоквартирными домами",
  keywords: "управление домом, жилищно-коммунальное хозяйство, квартиры, счетчики",
};
  const locale = await getLocale();      // ← из cookie
  const messages = await getMessages();  // ← из getRequestConfig
  const mergedMessages = await messagesWithDefault(messages, locale);


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <NextIntlClientProvider locale={locale} messages={mergedMessages}>
          {children}
          <ToastProvider />
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
