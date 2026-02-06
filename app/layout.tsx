import "./globals.css";

export const metadata = {
  title: "Studio",
  description: "Web Site Tasarım",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  );
}