import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AgentProvider } from "./components/AgentProvider";
import { getSession } from "./lib/auth/session";

// Inter: the standard face for dense product UI, with tabular figures for counts and times
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas",
  description: "AI-first customer support: chatbot, ticket desk and analytics.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AgentProvider session={session && "org" in session ? session : null}>{children}</AgentProvider>
      </body>
    </html>
  );
}
