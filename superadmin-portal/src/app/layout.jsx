import "./globals.css";

export const metadata = {
  title: "FoxHQ | Super Admin Portal",
  description: "Advanced Access Control Command Center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-blue-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
