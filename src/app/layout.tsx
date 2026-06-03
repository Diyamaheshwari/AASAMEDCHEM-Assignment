import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AasaMedChem | Inventory & Order Management',
  description: 'Precision inventory control, unit conversions, and order processing for chemical reagents and laboratory solutions.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('theme');
                  const theme = saved || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  console.error('Theme initialization failed:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
