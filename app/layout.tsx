import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// 数字全用等宽，时间轴拖动时不会左右抖
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Danish Housing — see what is happening in Danish real estate",
  description:
    "Quarterly prices, selling times, transaction volume and supply for all 98 Danish kommuner, from Finans Danmark and Danmarks Statistik.",
  openGraph: {
    title: "Danish Housing",
    description: "See what is happening in Danish real estate.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      // 下面那段内联脚本会在 React 接管之前往 <html> 上加 data-theme，
      // 服务端渲染的 HTML 上没有这个属性，React 会报 hydration 不匹配。
      // 这正是"先落主题再绘制"的代价，属于预期之内，压掉这一条警告。
      suppressHydrationWarning
    >
      <head>
        {/* 必须在首次绘制之前跑：否则选了深色的人每次打开都会被白底闪一下。
            读不到 localStorage（隐私模式）就什么都不做，落回跟随系统。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=localStorage.getItem('dkh-theme');if(c==='light'||c==='dark')document.documentElement.setAttribute('data-theme',c);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
