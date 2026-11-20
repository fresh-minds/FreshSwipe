'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { swipesApi, usersApi, UserWithSkills } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './swipe.module.css';

type SwipeDirection = 'left' | 'right' | 'super';

const BATCH_SIZE = 20;

export default function SwipePage() {
    const { currentUser, authToken, sessionStatus, hasSkills, loading: userLoading } = useCurrentUser();
    const [candidates, setCandidates] = useState<UserWithSkills[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSwiping, setIsSwiping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [swipeHistory, setSwipeHistory] = useState<{ user: UserWithSkills; direction: SwipeDirection }[]>([]);
    const [showComplete, setShowComplete] = useState(false);
    const [showAllSkills, setShowAllSkills] = useState(false);
    const [matchedCandidate, setMatchedCandidate] = useState<UserWithSkills | null>(null);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);
    const isSwipingRef = useRef(false);

    // Motion values for drag
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-20, 20]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    const leftIndicatorOpacity = useTransform(x, [-150, 0], [1, 0]);
    const rightIndicatorOpacity = useTransform(x, [0, 150], [0, 1]);
    const superIndicatorOpacity = useTransform(y, [-150, 0], [1, 0]);

    const fetchCandidates = useCallback(async () => {
        if (!authToken) return [];
        const candidatesData = await usersApi.getCandidates(authToken, BATCH_SIZE);
        const filtered = Array.isArray(candidatesData)
            ? candidatesData.filter((c) => c.id !== currentUser?.id)
            : [];
        return filtered;
    }, [authToken, currentUser?.id]);

    useEffect(() => {
        let isMounted = true;

        const initPage = async () => {
            if (sessionStatus === 'unauthenticated') {
                signIn('azure-ad');
                return;
            }
            if (sessionStatus !== 'authenticated' || userLoading) {
                return;
            }
            try {
                setError(null);
                const list = await fetchCandidates();
                if (isMounted) {
                    setCandidates(list);
                    setCurrentIndex(0);
                    setShowComplete(false);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Failed to initialize swipe page:', err);
                if (isMounted) {
                    setCandidates([]);
                    setError('Could not load colleagues right now. Please try refreshing.');
                    setIsLoading(false);
                }
            }
        };

        initPage();
        return () => {
            isMounted = false;
        };
    }, [sessionStatus, userLoading, fetchCandidates]);

    const recordSwipe = useCallback(async (direction: SwipeDirection) => {
        if (isSwipingRef.current || !authToken || currentIndex >= candidates.length) {
            return;
        }
        const candidate = candidates[currentIndex];
        if (!candidate) return;

        isSwipingRef.current = true;
        setIsSwiping(true);
        setError(null);
        setShowAllSkills(false);

        try {
            const res = await swipesApi.create(
                {
                    user_id: currentUser?.id,
                    target_user_id: candidate.id,
                    direction,
                },
                authToken
            );

            setSwipeHistory((prev) => [...prev, { user: candidate, direction }]);

            if (res.is_match) {
                setMatchedCandidate(candidate);
            }

            if (currentIndex === candidates.length - 1) {
                // Check if another batch of candidates exists beyond the initial limit
                if (candidates.length >= BATCH_SIZE) {
                    const nextBatch = await fetchCandidates().catch(() => []);
                    if (nextBatch.length > 0) {
                        setCandidates(nextBatch);
                        setCurrentIndex(0);
                    } else {
                        setShowComplete(true);
                    }
                } else {
                    setShowComplete(true);
                }
            } else {
                setCurrentIndex((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Failed to record swipe:', err);
            setError('Could not record your swipe. Please try again.');
        } finally {
            x.set(0);
            y.set(0);
            isSwipingRef.current = false;
            setIsSwiping(false);
        }
    }, [authToken, currentIndex, candidates, currentUser?.id, fetchCandidates, x, y]);

    const handleUndo = useCallback(async () => {
        if (isSwipingRef.current || swipeHistory.length === 0 || !authToken) return;
        const last = swipeHistory[swipeHistory.length - 1];
        isSwipingRef.current = true;
        setIsSwiping(true);
        setError(null);

        try {
            await swipesApi.undo(last.user.id, authToken);
            setSwipeHistory((prev) => prev.slice(0, -1));
            setMatchedCandidate(null);

            if (showComplete) {
                setShowComplete(false);
                // Put the undone user back as current if we had finished the stack
                const idx = candidates.findIndex((c) => c.id === last.user.id);
                if (idx >= 0) {
                    setCurrentIndex(idx);
                } else {
                    setCandidates((prev) => [last.user, ...prev]);
                    setCurrentIndex(0);
                }
            } else if (currentIndex > 0 && candidates[currentIndex - 1]?.id === last.user.id) {
                setCurrentIndex((prev) => prev - 1);
            } else {
                setCandidates((prev) => [last.user, ...prev.slice(currentIndex)]);
                setCurrentIndex(0);
            }
        } catch (err) {
            console.error('Failed to undo swipe:', err);
            setError('Could not undo the last swipe.');
        } finally {
            isSwipingRef.current = false;
            setIsSwiping(false);
        }
    }, [swipeHistory, authToken, showComplete, candidates, currentIndex]);

    // Keyboard shortcuts: Left = Pass, Right = Connect, Up = Super Like, Z = Undo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (matchedCandidate || confirmResetOpen) {
                if (e.key === 'Escape') {
                    setMatchedCandidate(null);
                    setConfirmResetOpen(false);
                }
                return;
            }
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                recordSwipe('left');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                recordSwipe('right');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                recordSwipe('super');
            } else if ((e.key === 'z' || e.key === 'Z') && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordSwipe, handleUndo, matchedCandidate, confirmResetOpen]);

    const handleDragEnd = useCallback((
        _event: MouseEvent | TouchEvent | PointerEvent,
        info: { offset: { x: number; y: number } }
    ) => {
        const xOffset = info.offset.x;
        const yOffset = info.offset.y;

        if (yOffset < -100) {
            recordSwipe('super');
        } else if (xOffset > 100) {
            recordSwipe('right');
        } else if (xOffset < -100) {
            recordSwipe('left');
        }
    }, [recordSwipe]);

    const handleConfirmReset = async () => {
        if (!authToken) return;
        setResetting(true);
        setError(null);
        try {
            await swipesApi.reset(authToken);
            const list = await fetchCandidates();
            setCandidates(list);
            setCurrentIndex(0);
            setSwipeHistory([]);
            setShowComplete(false);
            setConfirmResetOpen(false);
        } catch (err) {
            console.error('Failed to reset swipes:', err);
            setError('Failed to reset swipes. Please try again.');
        } finally {
            setResetting(false);
        }
    };

    const currentCandidate = candidates[currentIndex];
    const nextCandidate = candidates[currentIndex + 1];

    if (isLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Finding colleagues...</p>
                </div>
            </div>
        );
    }

    const visibleCurrentSkills = currentCandidate
        ? (showAllSkills ? currentCandidate.current_skills : currentCandidate.current_skills.slice(0, 4))
        : [];
    const visibleGrowthSkills = currentCandidate
        ? (showAllSkills ? currentCandidate.growth_skills : currentCandidate.growth_skills.slice(0, 4))
        : [];
    const hiddenSkillCount = currentCandidate
        ? Math.max(0, currentCandidate.current_skills.length - 4) + Math.max(0, currentCandidate.growth_skills.length - 4)
        : 0;

    return (
        <div className="page">
            <Navbar />

            <main className={`${styles.main} bg-dots`}>
                {!userLoading && !hasSkills && (
                    <div className={styles.profilePrompt}>
                        <span>Add your skills so colleagues know how you can help each other.</span>
                        <Link href="/onboarding" className={styles.promptLink}>
                            Complete Profile →
                        </Link>
                    </div>
                )}

                {error && (
                    <div className={styles.errorBanner} role="alert">
                        {error}
                    </div>
                )}

                {showComplete ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={styles.completeContainer}
                    >
                        <div className={styles.completeIcon} aria-hidden="true">🎉</div>
                        <h2>All Caught Up!</h2>
                        <p>You&apos;ve reviewed all available colleagues.</p>

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

                        <div className={styles.completeActions}>
                            <Link href="/matches" className="btn btn-primary btn-lg">
                                View My Matches →
                            </Link>
                            {swipeHistory.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleUndo}
                                    className="btn btn-secondary"
                                    disabled={isSwiping}
                                >
                                    ↩ Undo Last Swipe
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirmResetOpen(true)}
                                className="btn btn-outline"
                            >
                                Reset Swipes &amp; Start Over
                            </button>
                        </div>
                    </motion.div>
                ) : !currentCandidate ? (
                    <div className={styles.completeContainer}>
                        <div className={styles.completeIcon} aria-hidden="true">👋</div>
                        <h2>No more colleagues</h2>
                        <p>Check back later as new colleagues join FreshSwipe!</p>
                        <div className={styles.completeActions}>
                            <Link href="/matches" className="btn btn-primary">
                                View My Matches →
                            </Link>
                            <button
                                type="button"
                                onClick={() => setConfirmResetOpen(true)}
                                className="btn btn-outline"
                            >
                                Reset Swipes &amp; Start Over
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.counter} aria-live="polite">
                            {currentIndex + 1} / {candidates.length}
                        </div>

                        <div className={styles.cardContainer}>
                            {nextCandidate && (
                                <div className={`${styles.card} ${styles.card2}`} aria-hidden="true">
                                    <div className={styles.avatarCircle}>
                                        {nextCandidate.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            )}

                            <AnimatePresence>
                                <motion.div
                                    key={currentCandidate.id}
                                    className={styles.card}
                                    style={{ x, y, rotate, opacity }}
                                    drag={!isSwiping}
                                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                    dragElastic={1}
                                    onDragEnd={handleDragEnd}
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{
                                        x: x.get() > 0 ? 500 : x.get() < 0 ? -500 : 0,
                                        y: y.get() < -50 ? -500 : 0,
                                        opacity: 0,
                                        scale: 0.6,
                                        transition: { duration: 0.2 }
                                    }}
                                >
                                    <motion.div
                                        className={`${styles.indicator} ${styles.indicatorLeft}`}
                                        style={{ opacity: leftIndicatorOpacity }}
                                        aria-hidden="true"
                                    >
                                        ✕
                                    </motion.div>
                                    <motion.div
                                        className={`${styles.indicator} ${styles.indicatorRight}`}
                                        style={{ opacity: rightIndicatorOpacity }}
                                        aria-hidden="true"
                                    >
                                        ✓
                                    </motion.div>
                                    <motion.div
                                        className={`${styles.indicator} ${styles.indicatorSuper}`}
                                        style={{ opacity: superIndicatorOpacity }}
                                        aria-hidden="true"
                                    >
                                        ⭐
                                    </motion.div>

                                    <div className={styles.cardContent}>
                                        <div className={styles.avatarCircle}>
                                            {currentCandidate.name.charAt(0).toUpperCase()}
                                        </div>
                                        <h2 className={styles.cardTitle}>{currentCandidate.name}</h2>
                                        <div className={styles.cardMetaRow}>
                                            <span className={styles.cardCategory}>{currentCandidate.unit}</span>
                                            {currentCandidate.seniority && (
                                                <span className={styles.cardSeniority}>{currentCandidate.seniority}</span>
                                            )}
                                        </div>
                                        {currentCandidate.availability && (
                                            <p className={styles.cardAvailability}>
                                                ⏰ {currentCandidate.availability}
                                            </p>
                                        )}

                                        {/* Always-visible skills (touch & mobile friendly) */}
                                        <div className={styles.skillsPreview}>
                                            {visibleCurrentSkills.length > 0 && (
                                                <div className={styles.skillsSection}>
                                                    <h4>Can help with</h4>
                                                    <div className={styles.skillTags}>
                                                        {visibleCurrentSkills.map(s => (
                                                            <span key={s.id} className={styles.skillTag}>{s.skill_name}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {visibleGrowthSkills.length > 0 && (
                                                <div className={styles.skillsSection}>
                                                    <h4>Wants to learn</h4>
                                                    <div className={styles.skillTags}>
                                                        {visibleGrowthSkills.map(s => (
                                                            <span key={s.id} className={`${styles.skillTag} ${styles.growthTag}`}>{s.skill_name}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {hiddenSkillCount > 0 && (
                                                <button
                                                    type="button"
                                                    className={styles.toggleSkillsBtn}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onClick={() => setShowAllSkills((prev) => !prev)}
                                                >
                                                    {showAllSkills ? 'Show fewer skills' : `+${hiddenSkillCount} more skills`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Action buttons */}
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={`btn btn-icon btn-secondary ${styles.actionBtn} ${styles.undoBtn}`}
                                onClick={handleUndo}
                                disabled={swipeHistory.length === 0 || isSwiping}
                                title="Undo last swipe (Z)"
                                aria-label="Undo last swipe"
                            >
                                ↩
                            </button>
                            <button
                                type="button"
                                className={`btn btn-icon btn-danger ${styles.actionBtn}`}
                                onClick={() => recordSwipe('left')}
                                disabled={isSwiping}
                                title="Pass (Left Arrow)"
                                aria-label={`Pass on ${currentCandidate.name}`}
                            >
                                ✕
                            </button>
                            <button
                                type="button"
                                className={`btn btn-icon btn-super ${styles.actionBtn} ${styles.superBtn}`}
                                onClick={() => recordSwipe('super')}
                                disabled={isSwiping}
                                title="Super Like (Up Arrow)"
                                aria-label={`Super like ${currentCandidate.name}`}
                            >
                                ⭐
                            </button>
                            <button
                                type="button"
                                className={`btn btn-icon btn-success ${styles.actionBtn}`}
                                onClick={() => recordSwipe('right')}
                                disabled={isSwiping}
                                title="Connect (Right Arrow)"
                                aria-label={`Connect with ${currentCandidate.name}`}
                            >
                                ✓
                            </button>
                        </div>

                        <div className={styles.hint}>
                            <p>Drag card, tap buttons, or use arrow keys • ← Pass • ↑ Super Like • → Connect • Z Undo</p>
                        </div>
                    </>
                )}
            </main>

            {/* Mutual Match Celebration Modal */}
            <AnimatePresence>
                {matchedCandidate && (
                    <div
                        className={styles.modalOverlay}
                        onClick={() => setMatchedCandidate(null)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="match-modal-title"
                    >
                        <motion.div
                            className={styles.modalCard}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.matchSparkle} aria-hidden="true">✨☕✨</div>
                            <h2 id="match-modal-title">It&apos;s a Match!</h2>
                            <p>
                                You and <strong>{matchedCandidate.name}</strong> both want to connect!
                            </p>
                            <div className={styles.modalActions}>
                                {matchedCandidate.email && (
                                    <a
                                        href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(matchedCandidate.email)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                    >
                                        💬 Message on Teams
                                    </a>
                                )}
                                <Link href="/matches" className="btn btn-secondary">
                                    View All Matches
                                </Link>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setMatchedCandidate(null)}
                                >
                                    Keep Swiping
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reset Confirmation Modal */}
            <AnimatePresence>
                {confirmResetOpen && (
                    <div
                        className={styles.modalOverlay}
                        onClick={() => !resetting && setConfirmResetOpen(false)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reset-modal-title"
                    >
                        <motion.div
                            className={styles.modalCard}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="reset-modal-title">Reset Swipes?</h2>
                            <p>
                                This will clear all your previous swipes and matches so you can browse colleagues again. This cannot be undone.
                            </p>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleConfirmReset}
                                    disabled={resetting}
                                >
                                    {resetting ? 'Resetting...' : 'Yes, Reset Swipes'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setConfirmResetOpen(false)}
                                    disabled={resetting}
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
