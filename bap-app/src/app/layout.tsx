import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bureau Auxiliaire de Presse",
  description: "Outil de gestion du Bureau Auxiliaire de Presse — Administration de la Sécurité de l'Information & des Archives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={lexend.variable}>
      <body>{children}</body>
    </html>
  );
}
