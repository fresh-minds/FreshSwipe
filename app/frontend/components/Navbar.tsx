'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useCurrentUser } from '@/lib/user-context';
import styles from './Navbar.module.css';

interface NavItem {
    href: string;
    label: string;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/swipe', label: 'Swipe' },
    { href: '/coffee-dates', label: '☕ Coffee' },
    { href: '/matches', label: 'Matches' },
    { href: '/insights', label: 'Insights' },
    { href: '/team-trends', label: 'Trends' },
    { href: '/profile', label: 'Profile' },
];

export function Navbar({ minimal = false }: { minimal?: boolean }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { currentUser, isAdmin } = useCurrentUser();
    const [openForPath, setOpenForPath] = useState<string | null>(null);
    const menuOpen = openForPath === pathname;

    const displayName = currentUser?.name || session?.user?.name || 'User';
    const firstName = displayName.split(' ')[0];
    const feedbackHref =
        pathname && pathname !== '/feedback'
            ? `/feedback?from=${encodeURIComponent(pathname)}`
            : '/feedback';

    const handleSignOut = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('freshswipe_user_id');
            localStorage.removeItem('freshswipe_user_name');
            localStorage.removeItem('freshswipe_user_email');
        }
        signOut({ callbackUrl: '/login' });
    };

    const isActive = (href: string) =>
        pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));

    return (
        <header className="page-header">
            <div className="container">
                <nav className={styles.nav} aria-label="Main navigation">
                    <Link href="/" className={styles.brand}>
                        <Image
                            src="/logo.png"
                            alt="FreshSwipe Logo"
                            width={32}
                            height={32}
                            priority
                        />
                        <span>FreshSwipe</span>
                    </Link>

                    {!minimal && (
                        <>
                            <div className={styles.desktopLinks}>
                                {NAV_ITEMS.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`${styles.link} ${isActive(item.href) ? styles.active : ''}`}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                                <Link
                                    href={feedbackHref}
                                    className={`${styles.link} ${isActive('/feedback') ? styles.active : ''}`}
                                >
                                    Feedback
                                </Link>
                                {isAdmin && (
                                    <Link
                                        href="/admin"
                                        className={`${styles.link} ${styles.adminLink} ${isActive('/admin') ? styles.active : ''}`}
                                    >
                                        ⚙️ Admin
                                    </Link>
                                )}
                            </div>

                            <div className={styles.userActions}>
                                <Link href="/profile" className={styles.userBadge} title={displayName}>
                                    <span className={styles.avatar}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </span>
                                    <span className={styles.userName}>{firstName}</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className={styles.signOutBtn}
                                    title="Sign out"
                                >
                                    Sign out
                                </button>
                            </div>

                            <button
                                type="button"
                                className={styles.menuButton}
                                onClick={() => setOpenForPath((prev) => (prev === pathname ? null : pathname))}
                                aria-expanded={menuOpen}
                                aria-controls="mobile-nav-menu"
                                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                            >
                                <span className={styles.menuIcon}>{menuOpen ? '✕' : '☰'}</span>
                            </button>
                        </>
                    )}

                    {minimal && (
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className={styles.signOutBtn}
                        >
                            Sign out
                        </button>
                    )}
                </nav>

                {!minimal && menuOpen && (
                    <div id="mobile-nav-menu" className={styles.mobileMenu}>
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.mobileLink} ${isActive(item.href) ? styles.active : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href={feedbackHref}
                            className={`${styles.mobileLink} ${isActive('/feedback') ? styles.active : ''}`}
                        >
                            Feedback
                        </Link>
                        {isAdmin && (
                            <Link
                                href="/admin"
                                className={`${styles.mobileLink} ${styles.adminLink} ${isActive('/admin') ? styles.active : ''}`}
                            >
                                ⚙️ Admin
                            </Link>
                        )}
                        <div className={styles.mobileFooter}>
                            <span className={styles.mobileUser}>Signed in as {displayName}</span>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className={styles.signOutBtn}
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
