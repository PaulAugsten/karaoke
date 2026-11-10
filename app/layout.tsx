import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Karaoke',
    description: '',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className="bg-surface text-foreground antialiased">
                {children}
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
