'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { ChatBot } from '@/components/ChatBot';
import { useCurrentUser } from '@/lib/user-context';
import styles from './page.module.css';

export default function Home() {
    const { hasSkills, loading } = useCurrentUser();
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="page">
            <Navbar />

            <main className="page-content">
                <div className="container container-md text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className={styles.heroTitle}>
                            Connect with Colleagues &amp;
                            <span className={styles.gradient}> Grow Your Skills</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            Share your expertise and learning goals, swipe to connect with
                            FreshMinds colleagues, and turn shared ambitions into coffee chats.
                        </p>
                    </motion.div>

                    <motion.div
                        className={styles.heroCards}
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        <div className={styles.cardStackWrapper}>
                            <div className={styles.cardStack}>
                                <div className={`${styles.demoCard} ${styles.card3}`} aria-hidden="true">
                                    <span className={styles.cardIcon}>🔒</span>
                                </div>
                                <div className={`${styles.demoCard} ${styles.card2}`} aria-hidden="true">
                                    <span className={styles.cardIcon}>☁️</span>
                                </div>
                                <motion.button
                                    type="button"
                                    className={`${styles.demoCard} ${styles.card1} ${styles.clickableCard}`}
                                    onClick={() => setIsChatOpen((prev) => !prev)}
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.98 }}
                                    aria-expanded={isChatOpen}
                                >
                                    <span className={styles.cardIcon} aria-hidden="true">🤖</span>
                                    <span className={styles.cardTitle}>FreshBot</span>
                                    <span className={styles.chatHint}>Click to ask about colleagues</span>
                                </motion.button>
                            </div>
                            <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        </div>
                    </motion.div>

                    <motion.div
                        className={styles.heroCta}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {!loading && hasSkills ? (
                            <div className={styles.ctaGroup}>
                                <Link href="/swipe" className="btn btn-primary btn-lg">
                                    Start Swiping
                                    <span aria-hidden="true">→</span>
                                </Link>
                                <Link href="/profile" className="btn btn-secondary btn-lg">
                                    Update My Skills
                                </Link>
                            </div>
                        ) : (
                            <Link href="/onboarding" className="btn btn-primary btn-lg">
                                Get Started
                                <span aria-hidden="true">→</span>
                            </Link>
                        )}
                    </motion.div>

                    <motion.div
                        className={styles.features}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.45 }}
                    >
                        <Link href="/swipe" className={styles.feature}>
                            <div className={styles.featureIcon} aria-hidden="true">👆</div>
                            <h3>Swipe to Connect</h3>
                            <p>Browse colleagues&apos; skills — right to connect, up to super-like, left to pass</p>
                        </Link>
                        <Link href="/coffee-dates" className={styles.feature}>
                            <div className={styles.featureIcon} aria-hidden="true">☕</div>
                            <h3>Coffee Dates</h3>
                            <p>Get matched with mentors and peers and schedule a quick coffee chat</p>
                        </Link>
                        <Link href="/team-trends" className={styles.feature}>
                            <div className={styles.featureIcon} aria-hidden="true">🏢</div>
                            <h3>Team Trends</h3>
                            <p>Discover which skills colleagues want to learn across FreshMinds</p>
                        </Link>
                    </motion.div>
                </div>
            </main>

            <footer className={styles.footer}>
                <div className="container text-center">
                    <p className="text-muted">FreshSwipe — Internal Skills &amp; Colleague Discovery Platform</p>
                </div>
            </footer>
        </div>
    );
}
