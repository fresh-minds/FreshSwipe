'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { coffeeDatesApi, CoffeeDateSuggestion, CoffeeDate } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './coffee-dates.module.css';

type Tab = 'suggestions' | 'requests';
type MatchFilter = 'all' | 'mentor' | 'peer';

const DEFAULT_LOCATION = 'Microsoft Teams call';
const DEFAULT_MESSAGE = "Hey! I'd love to grab a virtual coffee and chat about our shared interests!";

export default function CoffeeDatesPage() {
    const router = useRouter();
    const { currentUser, authToken, sessionStatus, loading: userLoading } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<Tab>('suggestions');
    const [suggestions, setSuggestions] = useState<CoffeeDateSuggestion[]>([]);
    const [coffeeDates, setCoffeeDates] = useState<CoffeeDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<MatchFilter>('all');
    const [banner, setBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    // Request modal state
    const [draftTarget, setDraftTarget] = useState<CoffeeDateSuggestion | null>(null);
    const [draftLocation, setDraftLocation] = useState(DEFAULT_LOCATION);
    const [draftMessage, setDraftMessage] = useState(DEFAULT_MESSAGE);

    const loadData = useCallback(async (selectedFilter: MatchFilter) => {
        if (!authToken) return;
        setLoading(true);
        try {
            const [suggs, dates] = await Promise.all([
                coffeeDatesApi.getSuggestions(
                    12,
                    selectedFilter === 'all' ? undefined : selectedFilter,
                    authToken
                ),
                coffeeDatesApi.list(undefined, authToken),
            ]);
            setSuggestions(suggs);
            setCoffeeDates(dates);
        } catch (err) {
            console.error('Failed to load coffee dates:', err);
            setBanner({ type: 'error', text: 'Could not load coffee dates right now. Please try again.' });
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        if (sessionStatus === 'unauthenticated') {
            router.push('/login?callbackUrl=/coffee-dates');
            return;
        }
        if (sessionStatus === 'authenticated' && !userLoading && authToken) {
            loadData(filter);
        }
    }, [sessionStatus, userLoading, authToken, filter, router, loadData]);

    const openRequestModal = (suggestion: CoffeeDateSuggestion) => {
        setDraftTarget(suggestion);
        setDraftLocation(DEFAULT_LOCATION);
        setDraftMessage(DEFAULT_MESSAGE);
        setBanner(null);
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draftTarget || !authToken) return;
        setSubmittingId(draftTarget.user_id);
        setBanner(null);
        try {
            await coffeeDatesApi.createRequest(
                {
                    recipient_id: draftTarget.user_id,
                    location: draftLocation.trim() || DEFAULT_LOCATION,
                    message: draftMessage.trim() || DEFAULT_MESSAGE,
                },
                authToken
            );
            const targetName = draftTarget.user_name;
            setDraftTarget(null);
            setBanner({ type: 'success', text: `Coffee invite sent to ${targetName}!` });
            await loadData(filter);
        } catch (err) {
            console.error('Failed to send coffee date request:', err);
            setBanner({
                type: 'error',
                text: err instanceof Error ? err.message : 'Failed to send coffee invite.',
            });
        } finally {
            setSubmittingId(null);
        }
    };

    const handleRespond = async (id: string, response: 'accepted' | 'declined') => {
        if (!authToken) return;
        setSubmittingId(id);
        setBanner(null);
        try {
            await coffeeDatesApi.respond(id, response, authToken);
            setBanner({
                type: 'success',
                text: response === 'accepted' ? 'Coffee date accepted!' : 'Coffee date declined.',
            });
            await loadData(filter);
        } catch (err) {
            console.error('Failed to respond:', err);
            setBanner({
                type: 'error',
                text: err instanceof Error ? err.message : 'Failed to update coffee date.',
            });
        } finally {
            setSubmittingId(null);
        }
    };

    const handleComplete = async (id: string) => {
        if (!authToken) return;
        setSubmittingId(id);
        setBanner(null);
        try {
            await coffeeDatesApi.complete(id, authToken);
            setBanner({ type: 'success', text: 'Marked coffee date as completed!' });
            await loadData(filter);
        } catch (err) {
            console.error('Failed to complete coffee date:', err);
            setBanner({
                type: 'error',
                text: err instanceof Error ? err.message : 'Failed to complete coffee date.',
            });
        } finally {
            setSubmittingId(null);
        }
    };

    const getMatchTypeIcon = (type: string) => {
        switch (type) {
            case 'mutual': return '❤️';
            case 'mentor': return '🚀';
            case 'mentee': return '🌱';
            default: return '🤝';
        }
    };

    const getMatchTypeLabel = (type: string) => {
        switch (type) {
            case 'mutual': return 'Mutual Swipe Match';
            case 'mentor': return 'Skill Mentor Match';
            case 'mentee': return 'Potential Mentee';
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

    const currentUserId = currentUser?.id || null;
    const pendingReceived = coffeeDates.filter(
        cd => cd.recipient_id === currentUserId && cd.status === 'requested'
    );
    const sentPending = coffeeDates.filter(
        cd => cd.requester_id === currentUserId && cd.status === 'requested'
    );
    const accepted = coffeeDates.filter(cd => cd.status === 'accepted');
    const completed = coffeeDates.filter(cd => cd.status === 'completed');

    if (loading || userLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Finding your coffee matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <Navbar />

            <main className={styles.main}>
                <div className="container">
                    <div className={styles.pageHeader}>
                        <h1>☕ Coffee Date Matches</h1>
                        <p>Connect with FreshMinds colleagues who share your skills and learning goals</p>
                    </div>

                    {banner && (
                        <div
                            role={banner.type === 'error' ? 'alert' : 'status'}
                            className={banner.type === 'error' ? styles.errorBanner : styles.successBanner}
                        >
                            <span>{banner.text}</span>
                            <button
                                type="button"
                                className={styles.dismissBtn}
                                onClick={() => setBanner(null)}
                                aria-label="Dismiss notification"
                            >
                                ×
                            </button>
                        </div>
                    )}

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
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{completed.length}</span>
                            <span className={styles.statLabel}>Completed</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs} role="tablist" aria-label="Coffee dates sections">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'suggestions'}
                            className={`${styles.tab} ${activeTab === 'suggestions' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('suggestions')}
                        >
                            🎯 Suggestions
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'requests'}
                            className={`${styles.tab} ${activeTab === 'requests' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            📬 My Requests
                            {pendingReceived.length > 0 && (
                                <span className={styles.badge}>{pendingReceived.length}</span>
                            )}
                        </button>
                    </div>

                    {activeTab === 'suggestions' && (
                        <div className={styles.filterPills} role="group" aria-label="Filter suggestions">
                            {(
                                [
                                    { value: 'all', label: 'All Suggestions' },
                                    { value: 'mentor', label: '🚀 Mentor Matches' },
                                    { value: 'peer', label: '🤝 Peers' },
                                ] as const
                            ).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`${styles.filterPill} ${filter === opt.value ? styles.activeFilterPill : ''}`}
                                    onClick={() => setFilter(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}

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
                                            transition={{ delay: index * 0.04 }}
                                        >
                                            <div className={styles.cardHeader}>
                                                <div className={styles.avatar}>
                                                    {suggestion.user_name.charAt(0).toUpperCase()}
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

                                            {(suggestion.user_seniority || suggestion.user_availability) && (
                                                <div className={styles.meta}>
                                                    {suggestion.user_seniority && (
                                                        <span>📊 {suggestion.user_seniority}</span>
                                                    )}
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
                                                type="button"
                                                className={styles.requestButton}
                                                onClick={() => openRequestModal(suggestion)}
                                                disabled={submittingId === suggestion.user_id}
                                            >
                                                ☕ Request Coffee Date
                                            </button>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className={styles.empty}>
                                        <span className={styles.emptyIcon} aria-hidden="true">🔍</span>
                                        <h3>No suggestions yet</h3>
                                        <p>Update your skills or swipe on colleagues to discover coffee date matches!</p>
                                        <Link href="/swipe" className="btn btn-primary">
                                            Swipe Colleagues →
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
                                                        {cd.location && <p>📍 {cd.location}</p>}
                                                        {cd.message && <p className={styles.message}>&quot;{cd.message}&quot;</p>}
                                                    </div>
                                                    <div className={styles.requestActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.acceptBtn}
                                                            onClick={() => handleRespond(cd.id, 'accepted')}
                                                            disabled={submittingId === cd.id}
                                                        >
                                                            ✓ Accept
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.declineBtn}
                                                            onClick={() => handleRespond(cd.id, 'declined')}
                                                            disabled={submittingId === cd.id}
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
                                                const otherEmail = isRequester ? cd.recipient_email : cd.requester_email;
                                                return (
                                                    <div key={cd.id} className={`${styles.requestCard} ${styles.accepted}`}>
                                                        <div className={styles.requestInfo}>
                                                            <strong>☕ Coffee with {otherPerson}</strong>
                                                            <p>📍 {cd.location || 'Location TBD'}</p>
                                                            {cd.message && <p className={styles.message}>&quot;{cd.message}&quot;</p>}
                                                        </div>
                                                        <div className={styles.acceptedActions}>
                                                            <span className={styles.statusBadge}>Confirmed</span>
                                                            <div className={styles.acceptedButtonRow}>
                                                                {otherEmail && (
                                                                    <a
                                                                        className={styles.calendarButton}
                                                                        href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('FreshSwipe Coffee Date: ' + otherPerson)}&body=${encodeURIComponent(`Hi ${otherPerson},\n\nI'm looking forward to our coffee date! Does this time work for you?\n\nBest,`)}&to=${encodeURIComponent(otherEmail)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        📅 Schedule
                                                                    </a>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className={styles.completeBtn}
                                                                    onClick={() => handleComplete(cd.id)}
                                                                    disabled={submittingId === cd.id}
                                                                >
                                                                    ✓ Mark Done
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sent Requests */}
                                {sentPending.length > 0 && (
                                    <div className={styles.section}>
                                        <h2 className={styles.sectionTitle}>📤 Sent Requests</h2>
                                        <div className={styles.requestsList}>
                                            {sentPending.map(cd => (
                                                <div key={cd.id} className={`${styles.requestCard} ${styles.pending}`}>
                                                    <div className={styles.requestInfo}>
                                                        <strong>Waiting for {cd.recipient_name}</strong>
                                                        <p>📍 {cd.location || 'Location TBD'}</p>
                                                    </div>
                                                    <span className={styles.statusBadge}>Pending</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Completed History */}
                                {completed.length > 0 && (
                                    <div className={styles.section}>
                                        <h2 className={styles.sectionTitle}>✅ Completed Coffee Dates</h2>
                                        <div className={styles.requestsList}>
                                            {completed.map(cd => {
                                                const otherPerson = cd.requester_id === currentUserId
                                                    ? cd.recipient_name
                                                    : cd.requester_name;
                                                return (
                                                    <div key={cd.id} className={styles.requestCard}>
                                                        <div className={styles.requestInfo}>
                                                            <strong>☕ Coffee with {otherPerson}</strong>
                                                            <p>{cd.location || 'Completed'}</p>
                                                        </div>
                                                        <span className={styles.completedBadge}>Completed</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {coffeeDates.length === 0 && (
                                    <div className={styles.empty}>
                                        <span className={styles.emptyIcon} aria-hidden="true">📭</span>
                                        <h3>No coffee dates yet</h3>
                                        <p>Send your first coffee date request from the suggestions tab!</p>
                                        <button
                                            type="button"
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

            {/* Customize Coffee Invite Modal */}
            <AnimatePresence>
                {draftTarget && (
                    <div
                        className={styles.modalOverlay}
                        onClick={() => !submittingId && setDraftTarget(null)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="coffee-invite-title"
                    >
                        <motion.div
                            className={styles.modalCard}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="coffee-invite-title">Invite {draftTarget.user_name} for Coffee</h2>
                            <p className={styles.modalSubtitle}>
                                Personalize your note and preferred format before sending.
                            </p>
                            <form onSubmit={handleSendRequest}>
                                <div className="form-group">
                                    <label htmlFor="coffee-location" className="form-label">Location / Format</label>
                                    <input
                                        id="coffee-location"
                                        type="text"
                                        className="form-input"
                                        value={draftLocation}
                                        onChange={(e) => setDraftLocation(e.target.value)}
                                        placeholder="e.g. Microsoft Teams call, Utrecht office"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="coffee-message" className="form-label">Message</label>
                                    <textarea
                                        id="coffee-message"
                                        className="form-input"
                                        rows={4}
                                        value={draftMessage}
                                        onChange={(e) => setDraftMessage(e.target.value)}
                                    />
                                </div>
                                <div className={styles.modalActions}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setDraftTarget(null)}
                                        disabled={submittingId !== null}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submittingId !== null}
                                    >
                                        {submittingId ? 'Sending...' : 'Send Invite ☕'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
