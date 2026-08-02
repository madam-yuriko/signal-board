import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Signal Board | CPU・GPU・APU・再開発・映画・ボクシング・災害";
const description =
  "CPU・GPU・APU、再開発、映画、ボクシング、災害をまとめて確認できる情報ボード。";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.png", width: 1760, height: 920, alt: "Signal Board" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col bg-[#0b0c0f] text-[#f3f4f6]">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('fontScale-v4');if(s){document.documentElement.style.fontSize=s+'%'}}catch(e){}",
          }}
        />
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4 sm:py-6 lg:px-6">
          {children}
        </main>
        <footer className="border-t border-white/5 py-4 text-center text-[11px] text-gray-600">
          Signal Board — ボクシング興行はJBC公開情報、その他は開発用データです。
        </footer>
      </body>
    </html>
  );
}
