import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'FreshSwipe - Professional Skills Matching',
    description: 'Discover and express interest in professional skills with a swipe',
};

import { NextAuthProvider } from './providers';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-gradient bg-dots">
                <NextAuthProvider>
                    {children}
                </NextAuthProvider>
            </body>
        </html>
    );
}
