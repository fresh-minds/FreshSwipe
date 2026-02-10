'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

const ADMIN_EMAIL = 'karel.goense@freshminds.nl';

import { ChatBot } from '@/components/ChatBot';

export default function Home() {
    const { data: session } = useSession();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        // Check both session email and localStorage email
        const localEmail = localStorage.getItem('freshswipe_user_email');
        const sessionEmail = session?.user?.email;
        const userEmail = sessionEmail || localEmail;
        setIsAdmin(userEmail === ADMIN_EMAIL);
    }, [session]);

    return (
        <div className="page">
            <header className="page-header">
                <div className="container">
                    <nav className="nav">
                        <div className="nav-brand">
                            <Image src="/logo.png" alt="FreshSwipe Logo" width={32} height={32} className="mr-2" />
                            <span>FreshSwipe</span>
                        </div>
                        <div className="nav-links">
                            <Link href="/swipe" className="nav-link">Swipe</Link>
                            <Link href="/coffee-dates" className="nav-link">☕ Coffee</Link>
                            <Link href="/matches" className="nav-link">Matches</Link>
                            <Link href="/profile" className="nav-link">Profile</Link>
                            <Link href="/insights" className="nav-link">Insights</Link>
                            <Link href="/feedback" className="nav-link">Feedback</Link>
                            {isAdmin && (
                                <Link href="/admin" className="nav-link" style={{ color: '#f59e0b' }}>
                                    ⚙️ Admin
                                </Link>
                            )}
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container container-md text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className={styles.heroTitle}>
                            Discover Your
                            <span className={styles.gradient}> Professional Interests</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            Swipe through skills and domains to express your interests,
                            growth ambitions, and active engagement areas.
                        </p>
                    </motion.div>

                    <motion.div
                        className={styles.heroCards}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className={styles.cardStackWrapper}>
                            <div className={styles.cardStack}>
                                <div className={`${styles.demoCard} ${styles.card3}`}>
                                    <span className={styles.cardIcon}>🔒</span>
                                </div>
                                <div className={`${styles.demoCard} ${styles.card2}`}>
                                    <span className={styles.cardIcon}>☁️</span>
                                </div>
                                <motion.div
                                    className={`${styles.demoCard} ${styles.card1} ${styles.clickableCard}`}
                                    onClick={() => setIsChatOpen(!isChatOpen)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.98 }}
                                    title="Click to chat with FreshBot!"
                                >
                                    <span className={styles.cardIcon}>🤖</span>
                                    <span className={styles.chatHint}>Click to chat!</span>
                                </motion.div>
                            </div>
                            <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        </div>
                    </motion.div>

                    <motion.div
                        className={styles.heroCta}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <Link href="/onboarding" className="btn btn-primary btn-lg">
                            Get Started
                            <span>→</span>
                        </Link>
                    </motion.div>

                    <motion.div
                        className={styles.features}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        <Link href="/swipe" className={styles.feature}>
                            <div className={styles.featureIcon}>👆</div>
                            <h3>Swipe to Express</h3>
                            <p>Right for interested, left for not relevant, up for super-like</p>
                        </Link>
                        <Link href="/insights" className={styles.feature}>
                            <div className={styles.featureIcon}>📊</div>
                            <h3>View Insights</h3>
                            <p>See your top interests and growth areas at a glance</p>
                        </Link>
                        <Link href="/team-trends" className={styles.feature}>
                            <div className={styles.featureIcon}>🏢</div>
                            <h3>Team Trends</h3>
                            <p>Discover what skills are trending across the organization</p>
                        </Link>
                    </motion.div>
                </div>
            </main>

            <footer className={styles.footer}>
                <div className="container text-center">
                    <p className="text-muted">FreshSwipe — Internal Skills Discovery Platform</p>
                </div>
            </footer>
        </div>
    );
}
