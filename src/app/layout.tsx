import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BAP Backend API',
  description: 'Backend API for BAP Workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
