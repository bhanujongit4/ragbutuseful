import "./globals.css";

export const metadata = {
  title: "Emberline",
  description: "Emberline is a warm, minimal workspace for PDF retrieval and repository intelligence.",
  icons: {
    icon: "/emberline-favicon.svg",
    shortcut: "/emberline-favicon.svg",
    apple: "/emberline-favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
