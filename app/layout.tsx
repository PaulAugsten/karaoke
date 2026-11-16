import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-bricolage',
});

export const metadata: Metadata = {
    title: 'Karaoke',
    description: 'Pick songs on your phone. Sing them on the big screen.',
};

export const viewport: Viewport = {
    colorScheme: 'dark',
    themeColor: '#120e24',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={bricolage.variable}>
            <body className="bg-background text-foreground antialiased">
                {children}
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
