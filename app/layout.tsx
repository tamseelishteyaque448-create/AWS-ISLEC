import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AWS ISLEC | Build your cloud future", template: "%s | AWS ISLEC" },
  description: "A student builder community for learning AWS, shipping projects, and growing in public.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
