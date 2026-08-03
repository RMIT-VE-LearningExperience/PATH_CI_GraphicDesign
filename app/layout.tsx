import type { Metadata } from "next";
import type { ReactNode } from "react";

import Providers from "./providers";
import GoogleAnalytics from "./components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "PATH CI GraphicDesign",
  description: "PATH CI GraphicDesign",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
