import type { Metadata, Viewport } from 'next';
import { Poppins, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { NextAuthProvider } from './providers';

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-poppins',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'FreshSwipe — Colleague & Skills Discovery',
    description: 'Connect with FreshMinds colleagues, share expertise, and grow your skills over coffee.',
    manifest: '/manifest.json',
};

export const viewport: Viewport = {
    themeColor: '#2F45C2',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={`${poppins.variable} ${jetbrainsMono.variable}`}>
            <body className="bg-gradient bg-dots">
                <NextAuthProvider>
                    {children}
                </NextAuthProvider>
            </body>
        </html>
    );
}
