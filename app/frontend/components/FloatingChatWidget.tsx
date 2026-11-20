'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChatBot } from '@/components/ChatBot';
import styles from '@/components/ChatBot.module.css';

export function FloatingChatWidget() {
    const pathname = usePathname();
    const { status } = useSession();
    const [isOpen, setIsOpen] = useState(false);

    // Hide on unauthenticated pages or onboarding
    if (status !== 'authenticated' || pathname === '/login' || pathname === '/onboarding') {
        return null;
    }

    return (
        <div className={styles.floatingRoot}>
            <ChatBot isOpen={isOpen} onClose={() => setIsOpen(false)} floating />
            <button
                type="button"
                className={styles.floatingFab}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Close FreshBot assistant' : 'Open FreshBot assistant'}
            >
                <span aria-hidden="true">🤖</span>
                <span>{isOpen ? 'Close FreshBot' : 'Ask FreshBot'}</span>
            </button>
        </div>
    );
}
