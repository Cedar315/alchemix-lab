import './globals.css';
import ProductActivity from '@/components/ProductActivity';
import React from 'react';
import AssistantProvider from '@/components/assistant/AssistantProvider';

export const metadata = {
  title: 'AlcheMix Lab',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0,0"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700;800&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AssistantProvider legacy={process.env.ASSISTANT_RUNTIME === 'legacy'}><ProductActivity/><main>{children}</main></AssistantProvider>
      </body>
    </html>
  );
}
