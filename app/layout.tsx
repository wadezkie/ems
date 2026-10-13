import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Figma uses Roboto throughout.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "EMS — Employee Management System",
    template: "%s · EMS",
  },
  description: "Employee Management System",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
