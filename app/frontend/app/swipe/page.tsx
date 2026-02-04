'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { swipesApi, usersApi, User } from '@/lib/api';
import styles from './swipe.module.css';

type SwipeDirection = 'left' | 'right' | 'super';

export default function SwipePage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [candidates, setCandidates] = useState<User[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [swipeHistory, setSwipeHistory] = useState<{ user: User; direction: SwipeDirection }[]>([]);
    const [showComplete, setShowComplete] = useState(false);

    // Motion values for drag
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    // Indicator transforms
    const leftIndicatorOpacity = useTransform(x, [-150, 0], [1, 0]);
    const rightIndicatorOpacity = useTransform(x, [0, 150], [0, 1]);
    const superIndicatorOpacity = useTransform(y, [-150, 0], [1, 0]);

    const authToken = (session as any)?.idToken || session?.accessToken;

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            // Fetch candidates
            usersApi.getCandidates(authToken)
                .then(data => {
                    if (Array.isArray(data)) {
                        setCandidates(data);
                    } else {
                        console.error('Candidates response is not an array:', data);
                        setCandidates([]);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load candidates:', err);
                    setCandidates([]);
                    setIsLoading(false);
                });

            // Ensure we have the correct backend user ID
            const storedId = typeof window !== 'undefined' ? localStorage.getItem('freshswipe_user_id') : null;
            if (!storedId && session?.user?.email) {
                usersApi.getByEmail(session.user.email, authToken)
                    .then((user) => {
                        if (user && user.id) {
                            localStorage.setItem('freshswipe_user_id', user.id);
                            localStorage.setItem('freshswipe_user_name', user.name);
                            localStorage.setItem('freshswipe_user_email', user.email);
                        }
                    })
                    .catch((err) => console.error('Failed to sync user ID:', err));
            }
        }
    }, [status, router, session?.user?.email, authToken]);

    const recordSwipe = useCallback(async (direction: SwipeDirection) => {
        // Priority: 1. localStorage (UUID from backend), 2. Session ID (might be OID or UUID)
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('freshswipe_user_id') : null;
        const userId = storedId || (session?.user as any)?.id;

        if (!userId || currentIndex >= candidates.length) {
            console.warn('Cannot record swipe: No userId found or invalid index');
            return;
        }

        const candidate = candidates[currentIndex];
        if (!candidate) return;

        try {
            await swipesApi.create({
                user_id: userId,
                target_user_id: candidate.id,
                direction,
            }, authToken);

            setSwipeHistory((prev) => [...prev, { user: candidate, direction }]);

            if (currentIndex === candidates.length - 1) {
                setShowComplete(true);
            } else {
                setCurrentIndex((prev: number) => prev + 1);
            }
        } catch (err) {
            console.error('Failed to record swipe:', err);
        }

        // Reset position
        x.set(0);
        y.set(0);
    }, [session, currentIndex, candidates, x, y]);

    const handleDragEnd = useCallback((
        _event: MouseEvent | TouchEvent | PointerEvent,
        info: { offset: { x: number; y: number } }
    ) => {
        const xOffset = info.offset.x;
        const yOffset = info.offset.y;

        // Super like (up swipe)
        if (yOffset < -100) {
            recordSwipe('super');
        }
        // Right swipe (interested)
        else if (xOffset > 100) {
            recordSwipe('right');
        }
        // Left swipe (not interested)
        else if (xOffset < -100) {
            recordSwipe('left');
        }
    }, [recordSwipe]);

    const handleButtonSwipe = (direction: SwipeDirection) => {
        recordSwipe(direction);
    };

    const currentCandidate = candidates[currentIndex];
    const nextCandidate = candidates[currentIndex + 1];

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Finding colleagues...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <header className="page-header">
                <div className="container">
                    <nav className="nav">
                        <Link href="/" className="nav-brand">
                            <Image src="/logo.png" alt="FreshSwipe Logo" width={32} height={32} className="mr-2" />
                            <span>FreshSwipe</span>
                        </Link>
                        <div className="nav-links">
                            <span className="text-secondary">Hi, {session?.user?.name || 'User'}</span>
                            <Link href="/insights" className="nav-link">My Insights</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className={styles.main}>
                {showComplete ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={styles.completeContainer}
                    >
                        <div className={styles.completeIcon}>🎉</div>
                        <h2>All Done!</h2>
                        <p>You&apos;ve swiped through all available colleagues.</p>

                        <div className={styles.summary}>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryValue}>
                                    {swipeHistory.filter(s => s.direction === 'right').length}
                                </span>
                                <span className={styles.summaryLabel}>Interested</span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={`${styles.summaryValue} ${styles.super}`}>
                                    {swipeHistory.filter(s => s.direction === 'super').length}
                                </span>
                                <span className={styles.summaryLabel}>Super Likes</span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryValue}>
                                    {swipeHistory.filter(s => s.direction === 'left').length}
                                </span>
                                <span className={styles.summaryLabel}>Passed</span>
                            </div>
                        </div>

                        <Link href="/matches" className="btn btn-primary btn-lg mt-xl">
                            View My Matches →
                        </Link>
                    </motion.div>
                ) : (
                    <>
                        <div className={styles.counter}>
                            {currentIndex + 1} / {candidates.length}
                        </div>

                        <div className={styles.cardContainer}>
                            {/* Background cards */}
                            {nextCandidate && (
                                <div className={`${styles.card} ${styles.card2}`}>
                                    <div className={styles.cardIcon}>{nextCandidate.name.charAt(0).toUpperCase()}</div>
                                </div>
                            )}

                            {/* Active card */}
                            <AnimatePresence>
                                {currentCandidate && (
                                    <motion.div
                                        key={currentCandidate.id}
                                        className={styles.card}
                                        style={{ x, y, rotate, opacity }}
                                        drag
                                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                        dragElastic={1}
                                        onDragEnd={handleDragEnd}
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{
                                            x: x.get() > 0 ? 500 : x.get() < 0 ? -500 : 0,
                                            y: y.get() < -50 ? -500 : 0,
                                            opacity: 0,
                                            scale: 0.5,
                                            transition: { duration: 0.2 }
                                        }}
                                    >
                                        {/* Swipe indicators */}
                                        <motion.div
                                            className={`${styles.indicator} ${styles.indicatorLeft}`}
                                            style={{ opacity: leftIndicatorOpacity }}
                                        >
                                            ✕
                                        </motion.div>
                                        <motion.div
                                            className={`${styles.indicator} ${styles.indicatorRight}`}
                                            style={{ opacity: rightIndicatorOpacity }}
                                        >
                                            ✓
                                        </motion.div>
                                        <motion.div
                                            className={`${styles.indicator} ${styles.indicatorSuper}`}
                                            style={{ opacity: superIndicatorOpacity }}
                                        >
                                            ⭐
                                        </motion.div>

                                        <div className={styles.cardContent}>
                                            <div className={styles.cardIcon}>
                                                {currentCandidate.name.charAt(0).toUpperCase()}
                                            </div>
                                            <h2 className={styles.cardTitle}>{currentCandidate.name}</h2>
                                            <span className={styles.cardCategory}>{currentCandidate.unit}</span>
                                            {currentCandidate.seniority && (
                                                <p className={styles.cardDescription}>{currentCandidate.seniority}</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Action buttons */}
                        <div className={styles.actions}>
                            <button
                                className={`btn btn-icon btn-danger ${styles.actionBtn}`}
                                onClick={() => handleButtonSwipe('left')}
                                title="Pass"
                            >
                                ✕
                            </button>
                            <button
                                className={`btn btn-icon btn-super ${styles.actionBtn} ${styles.superBtn}`}
                                onClick={() => handleButtonSwipe('super')}
                                title="Super Like"
                            >
                                ⭐
                            </button>
                            <button
                                className={`btn btn-icon btn-success ${styles.actionBtn}`}
                                onClick={() => handleButtonSwipe('right')}
                                title="Connect"
                            >
                                ✓
                            </button>
                        </div>

                        <div className={styles.hint}>
                            <p>Drag card or use buttons • Up = Super Like</p>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
