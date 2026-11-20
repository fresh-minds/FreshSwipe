'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import ProfileModal from '@/components/ProfileModal';
import { matchesApi, MatchItem } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './matches.module.css';

type FilterType = 'all' | 'mutual' | 'mentor' | 'peer';

export default function MatchesPage() {
    const { authToken, sessionStatus } = useCurrentUser();
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [filter, setFilter] = useState<FilterType>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const fetchMatches = useCallback(async (selectedFilter: FilterType) => {
        if (!authToken) return;
        setLoading(true);
        setError(null);
        try {
            const data = await matchesApi.list(
                selectedFilter === 'all' ? undefined : selectedFilter,
                50,
                authToken
            );
            const normalized = data.map((match) => ({
                ...match,
                reasons: Array.isArray(match.reasons) ? match.reasons : [],
            }));
            setMatches(normalized);
        } catch (err) {
            console.error('Failed to fetch matches', err);
            setMatches([]);
            setError('Unable to load matches right now. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        if (sessionStatus === 'authenticated' && authToken) {
            fetchMatches(filter);
        } else if (sessionStatus === 'unauthenticated') {
            setLoading(false);
        }
    }, [sessionStatus, authToken, filter, fetchMatches]);

    return (
        <div className="page">
            <Navbar />

            <main className="page-content">
                <div className="container">
                    <div className={styles.header}>
                        <h1>Your Matches</h1>
                        <div className={styles.filters} role="tablist" aria-label="Filter matches">
                            {(
                                [
                                    { key: 'all', label: 'All' },
                                    { key: 'mutual', label: '❤️ Mutual' },
                                    { key: 'mentor', label: '🚀 Mentors' },
                                    { key: 'peer', label: '🤝 Peers' },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === tab.key}
                                    className={filter === tab.key ? styles.activeFilter : ''}
                                    onClick={() => setFilter(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Finding your best matches...</div>
                    ) : error ? (
                        <div className={styles.empty} role="alert">
                            <p>{error}</p>
                            <button
                                type="button"
                                className="btn btn-secondary mt-md"
                                onClick={() => fetchMatches(filter)}
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <div className={styles.grid}>
                            {matches.map((match) => {
                                const calendarUrl = match.user_b_email
                                    ? `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Coffee Chat? ☕')}&body=${encodeURIComponent(`Hi ${match.user_b_name},\n\nI saw your profile on FreshSwipe and noticed we have compatible skills! Would you be open to grabbing a virtual or in-person coffee sometime?\n\nBest,`)}&to=${encodeURIComponent(match.user_b_email)}`
                                    : null;

                                return (
                                    <div
                                        key={match.id}
                                        className={`${styles.matchCard} ${match.match_type === 'mutual' ? styles.mutual : ''}`}
                                    >
                                        <div
                                            className={styles.scoreBadge}
                                            style={{
                                                backgroundColor: match.match_type === 'mutual' ? '#ef4444' : undefined,
                                                color: match.match_type === 'mutual' ? '#ffffff' : undefined,
                                            }}
                                        >
                                            {match.match_type === 'mutual' ? '❤️ Mutual' : `${Math.round(match.score)} pts`}
                                        </div>
                                        <h2 className={styles.userName}>{match.user_b_name}</h2>
                                        <h3 className={styles.matchType}>
                                            {match.match_type === 'mutual'
                                                ? "✨ It's a Match!"
                                                : match.match_type === 'mentor'
                                                    ? '🚀 Skill Mentor Match'
                                                    : '🤝 Professional Peer'}
                                        </h3>
                                        <ul className={styles.reasons}>
                                            {match.reasons.map((reason, i) => (
                                                <li key={i}>{reason}</li>
                                            ))}
                                        </ul>
                                        <div className={styles.actions}>
                                            <button
                                                type="button"
                                                className={styles.connectButton}
                                                onClick={() => setSelectedUserId(match.user_b_id)}
                                            >
                                                View Profile
                                            </button>
                                            {calendarUrl ? (
                                                <a
                                                    className={styles.teamsButton}
                                                    href={calendarUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    📅 Schedule Coffee
                                                </a>
                                            ) : (
                                                <span
                                                    className={`${styles.teamsButton} ${styles.disabledAction}`}
                                                    title="This colleague keeps their email private"
                                                >
                                                    🔒 Email Private
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {matches.length === 0 && (
                                <div className={styles.empty}>
                                    <p>
                                        No matches found for this filter yet. Swipe on colleagues or update your skills to discover new connections!
                                    </p>
                                    <div className={styles.emptyActions}>
                                        <Link href="/swipe" className="btn btn-primary">
                                            Swipe Colleagues →
                                        </Link>
                                        <Link href="/profile" className="btn btn-secondary">
                                            Update Skills
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <AnimatePresence>
                {selectedUserId && (
                    <ProfileModal
                        userId={selectedUserId}
                        authToken={authToken}
                        onClose={() => setSelectedUserId(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
