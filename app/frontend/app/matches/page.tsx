'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './matches.module.css';

interface Match {
    id: string;
    user_b_id: string;
    user_b_name: string;
    user_b_email: string | null;
    score: number;
    reasons: string[];
    match_type: string;
}

export default function MatchesPage() {
    const { data: session, status } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchMatches();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const fetchMatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/v1/matches/`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !Array.isArray(data)) {
                setMatches([]);
                setError('Unable to load matches right now. Please try again.');
                return;
            }

            const normalized = data.map((match: Match) => ({
                ...match,
                reasons: Array.isArray(match.reasons) ? match.reasons : [],
            }));
            setMatches(normalized);
        } catch (err) {
            console.error("Failed to fetch matches", err);
            setMatches([]);
            setError('Unable to load matches right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'unauthenticated') {
        return <div>Please sign in to view matches.</div>;
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

            <main className="page-content">
                <div className="container">
                    <div className={styles.header}>
                        <h1>Your Matches</h1>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Finding your perfect matches...</div>
                    ) : (
                        <div className={styles.grid}>
                            {error && (
                                <div className={styles.empty}>{error}</div>
                            )}
                            {matches.map(match => (
                                <div key={match.id} className={styles.matchCard}>
                                    <div className={styles.scoreBadge}>{Math.round(match.score)} pts</div>
                                    <h2 className={styles.userName}>{match.user_b_name}</h2>
                                    <h3 className={styles.matchType}>
                                        {match.match_type === 'mentor' ? '🚀 Potential Mentor' : '🤝 Professional Peer'}
                                    </h3>
                                    <ul className={styles.reasons}>
                                        {match.reasons.map((reason, i) => (
                                            <li key={i}>{reason}</li>
                                        ))}
                                    </ul>
                                    <div className={styles.actions}>
                                        <button
                                            className={styles.connectButton}
                                            onClick={() => alert(`Viewing profile for ${match.user_b_name}\nSkills: ${match.reasons.join(', ')}`)}
                                        >
                                            View Profile
                                        </button>
                                        <button
                                            className={styles.teamsButton}
                                            onClick={() => {
                                                if (match.user_b_email) {
                                                    window.open(`https://teams.microsoft.com/l/chat/0/0?users=${match.user_b_email}`, '_blank');
                                                } else {
                                                    alert("This user has hidden their email.");
                                                }
                                            }}
                                        >
                                            Teams Chat
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {matches.length === 0 && (
                                <div className={styles.empty}>
                                    No matches found yet. Keep swiping on skills to help us find overlaps!
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
