'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { coffeeDatesApi, CoffeeDateSuggestion, CoffeeDate } from '@/lib/api';
import styles from './coffee-dates.module.css';

type Tab = 'suggestions' | 'requests';

export default function CoffeeDatesPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [activeTab, setActiveTab] = useState<Tab>('suggestions');
    const [suggestions, setSuggestions] = useState<CoffeeDateSuggestion[]>([]);
    const [coffeeDates, setCoffeeDates] = useState<CoffeeDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [requestingId, setRequestingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, router]);

    const loadData = async () => {
        setLoading(true);
        try {
            const accessToken = authToken as string | undefined;
            const [suggs, dates] = await Promise.all([
                coffeeDatesApi.getSuggestions(10, undefined, accessToken),
                coffeeDatesApi.list(undefined, accessToken),
            ]);
            setSuggestions(suggs);
            setCoffeeDates(dates);
        } catch (err) {
            console.error('Failed to load coffee dates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCoffee = async (userId: string) => {
        setRequestingId(userId);
        try {
            await coffeeDatesApi.createRequest({
                recipient_id: userId,
                location: 'Teams call',
                message: "Hey! I&apos;d love to grab a virtual coffee and chat about our shared interests!",
            }, authToken as string | undefined);
            // Reload data
            await loadData();
        } catch (err) {
            console.error('Failed to send coffee date request:', err);
        } finally {
            setRequestingId(null);
        }
    };

    const handleRespond = async (id: string, response: 'accepted' | 'declined') => {
        try {
            await coffeeDatesApi.respond(id, response, authToken as string | undefined);
            await loadData();
        } catch (err) {
            console.error('Failed to respond:', err);
        }
    };

    const getMatchTypeIcon = (type: string) => {
        switch (type) {
            case 'mentor': return '🚀';
            case 'mentee': return '🌱';
            default: return '🤝';
        }
    };

    const getMatchTypeLabel = (type: string) => {
        switch (type) {
            case 'mentor': return 'Potential Mentor';
            case 'mentee': return 'Can Mentor You';
            default: return 'Peer Connection';
        }
    };

    const getUnitIcon = (unit: string) => {
        switch (unit) {
            case 'Software': return '💻';
            case 'Data': return '📊';
            case 'Cloud': return '☁️';
            case 'Security': return '🔒';
            default: return '🏢';
        }
    };

    const currentUserId = typeof window !== 'undefined'
        ? localStorage.getItem('freshswipe_user_id')
        : null;

    const pendingReceived = coffeeDates.filter(
        cd => cd.recipient_id === currentUserId && cd.status === 'requested'
    );
    const myRequests = coffeeDates.filter(cd => cd.requester_id === currentUserId);
    const accepted = coffeeDates.filter(cd => cd.status === 'accepted');

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Finding your coffee matches...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <header className="page-header">
                <div className="container">
                    <nav className="nav">
                        <Link href="/" className="nav-brand">
                            <span className="icon">☕</span>
                            <span>Coffee Dates</span>
                        </Link>
                        <div className="nav-links">
                            <span className="text-secondary">Hi, {session?.user?.name || 'User'}</span>
                            <Link href="/swipe" className="nav-link">Swipe Skills</Link>
                            <Link href="/insights" className="nav-link">My Insights</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className={styles.main}>
                <div className="container">
                    <div className={styles.pageHeader}>
                        <h1>☕ Coffee Date Matches</h1>
                        <p>Connect with FreshMinds colleagues who share your interests</p>
                    </div>

                    {/* Stats bar */}
                    <div className={styles.statsBar}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{suggestions.length}</span>
                            <span className={styles.statLabel}>Suggestions</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{pendingReceived.length}</span>
                            <span className={styles.statLabel}>Pending</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{accepted.length}</span>
                            <span className={styles.statLabel}>Upcoming</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'suggestions' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('suggestions')}
                        >
                            🎯 Suggestions
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'requests' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            📬 My Requests
                            {pendingReceived.length > 0 && (
                                <span className={styles.badge}>{pendingReceived.length}</span>
                            )}
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'suggestions' ? (
                            <motion.div
                                key="suggestions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={styles.grid}
                            >
                                {suggestions.length > 0 ? (
                                    suggestions.map((suggestion, index) => (
                                        <motion.div
                                            key={suggestion.user_id}
                                            className={styles.suggestionCard}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <div className={styles.cardHeader}>
                                                <div className={styles.avatar}>
                                                    {suggestion.user_name.charAt(0)}
                                                </div>
                                                <div className={styles.userInfo}>
                                                    <h3>{suggestion.user_name}</h3>
                                                    <span className={styles.unit}>
                                                        {getUnitIcon(suggestion.user_unit)} {suggestion.user_unit}
                                                    </span>
                                                </div>
                                                <div className={styles.scoreBadge}>
                                                    {Math.round(suggestion.score)} pts
                                                </div>
                                            </div>

                                            <div className={styles.matchType}>
                                                {getMatchTypeIcon(suggestion.match_type)} {getMatchTypeLabel(suggestion.match_type)}
                                            </div>

                                            {suggestion.user_seniority && (
                                                <div className={styles.meta}>
                                                    <span>📊 {suggestion.user_seniority}</span>
                                                    {suggestion.user_availability && (
                                                        <span>⏰ {suggestion.user_availability}</span>
                                                    )}
                                                </div>
                                            )}

                                            <div className={styles.reasons}>
                                                {suggestion.reasons.slice(0, 3).map((reason, i) => (
                                                    <span key={i} className={styles.reasonChip}>
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>

                                            <button
                                                className={styles.requestButton}
                                                onClick={() => handleRequestCoffee(suggestion.user_id)}
                                                disabled={requestingId === suggestion.user_id}
                                            >
                                                {requestingId === suggestion.user_id ? (
                                                    'Sending...'
                                                ) : (
                                                    <>☕ Request Coffee Date</>
                                                )}
                                            </button>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className={styles.empty}>
                                        <span className={styles.emptyIcon}>🔍</span>
                                        <h3>No matches yet</h3>
                                        <p>Keep swiping on skills to get more coffee date suggestions!</p>
                                        <Link href="/swipe" className="btn btn-primary">
                                            Start Swiping →
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="requests"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {/* Pending Received */}
                                {pendingReceived.length > 0 && (
                                    <div className={styles.section}>
                                        <h2 className={styles.sectionTitle}>📥 Requests Received</h2>
                                        <div className={styles.requestsList}>
                                            {pendingReceived.map(cd => (
                                                <div key={cd.id} className={styles.requestCard}>
                                                    <div className={styles.requestInfo}>
                                                        <strong>{cd.requester_name}</strong> wants to grab coffee!
                                                        {cd.message && <p className={styles.message}>&quot;{cd.message}&quot;</p>}
                                                    </div>
                                                    <div className={styles.requestActions}>
                                                        <button
                                                            className={styles.acceptBtn}
                                                            onClick={() => handleRespond(cd.id, 'accepted')}
                                                        >
                                                            ✓ Accept
                                                        </button>
                                                        <button
                                                            className={styles.declineBtn}
                                                            onClick={() => handleRespond(cd.id, 'declined')}
                                                        >
                                                            ✕ Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Accepted (Upcoming) */}
                                {accepted.length > 0 && (
                                    <div className={styles.section}>
                                        <h2 className={styles.sectionTitle}>📅 Upcoming Coffee Dates</h2>
                                        <div className={styles.requestsList}>
                                            {accepted.map(cd => {
                                                const isRequester = cd.requester_id === currentUserId;
                                                const otherPerson = isRequester ? cd.recipient_name : cd.requester_name;
                                                return (
                                                    <div key={cd.id} className={`${styles.requestCard} ${styles.accepted}`}>
                                                        <div className={styles.requestInfo}>
                                                            <strong>☕ Coffee with {otherPerson}</strong>
                                                            <p>{cd.location || 'Location TBD'}</p>
                                                        </div>
                                                        <div className={styles.acceptedActions}>
                                                            <span className={styles.statusBadge}>Confirmed</span>
                                                            <a
                                                                className={styles.calendarButton}
                                                                href={isRequester ?
                                                                    `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent("FreshSwipe Coffee Date: " + otherPerson)}&body=${encodeURIComponent(`Hi ${otherPerson},\n\nI'm looking forward to our coffee date! Does this time work for you?\n\nBest,`)}&to=${cd.recipient_email}` :
                                                                    `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent("FreshSwipe Coffee Date: " + otherPerson)}&body=${encodeURIComponent(`Hi ${otherPerson},\n\nI'm looking forward to our coffee date! Does this time work for you?\n\nBest,`)}&to=${cd.requester_email}`
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                📅 Schedule
                                                            </a>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sent Requests */}
                                {myRequests.filter(r => r.status === 'requested').length > 0 && (
                                    <div className={styles.section}>
                                        <h2 className={styles.sectionTitle}>📤 Sent Requests</h2>
                                        <div className={styles.requestsList}>
                                            {myRequests.filter(r => r.status === 'requested').map(cd => (
                                                <div key={cd.id} className={`${styles.requestCard} ${styles.pending}`}>
                                                    <div className={styles.requestInfo}>
                                                        <strong>Waiting for {cd.recipient_name}</strong>
                                                        <p>Request sent</p>
                                                    </div>
                                                    <span className={styles.statusBadge}>Pending</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {coffeeDates.length === 0 && (
                                    <div className={styles.empty}>
                                        <span className={styles.emptyIcon}>📭</span>
                                        <h3>No coffee dates yet</h3>
                                        <p>Send your first coffee date request from the suggestions!</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setActiveTab('suggestions')}
                                        >
                                            View Suggestions
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
