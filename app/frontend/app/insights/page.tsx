'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { analyticsApi, UserSummary, coffeeDatesApi, CoffeeDate } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './insights.module.css';

const COLORS = ['#2F45C2', '#5467D5', '#7C8DEB', '#818CF8', '#6366F1'];

export default function InsightsPage() {
    const { currentUser, authToken, loading: userLoading } = useCurrentUser();
    const [summary, setSummary] = useState<UserSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [coffeeMatch, setCoffeeMatch] = useState<CoffeeDate | null>(null);
    const [matchingCoffee, setMatchingCoffee] = useState(false);
    const [coffeeError, setCoffeeError] = useState<string | null>(null);

    const getTeamsUrl = (email: string) =>
        `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`;

    useEffect(() => {
        if (userLoading) return;
        if (!currentUser || !authToken) {
            setIsLoading(false);
            return;
        }

        let active = true;
        setIsLoading(true);

        Promise.all([
            analyticsApi.getUserSummary(currentUser.id, authToken),
            coffeeDatesApi.list(undefined, authToken).catch(() => [] as CoffeeDate[]),
        ])
            .then(([summaryData, dates]) => {
                if (!active) return;
                setSummary(summaryData);
                const activeDate = dates.find(
                    (d) => d.status === 'accepted' || d.status === 'requested'
                );
                setCoffeeMatch(activeDate || null);
            })
            .catch((err) => {
                console.error('Failed to load insights:', err);
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [currentUser, authToken, userLoading]);

    const handleFindCoffeeMatch = async () => {
        if (!authToken) return;
        setMatchingCoffee(true);
        setCoffeeError(null);
        try {
            const match = await coffeeDatesApi.autoMatch(authToken);
            setCoffeeMatch(match);
        } catch (err) {
            console.error('Failed to auto-match coffee date:', err);
            setCoffeeError(
                err instanceof Error ? err.message : 'No coffee match available right now.'
            );
        } finally {
            setMatchingCoffee(false);
        }
    };

    if (isLoading || userLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Loading your insights...</p>
                </div>
            </div>
        );
    }

    if (!summary || !currentUser) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.emptyContainer}>
                    <h2>No Data Yet</h2>
                    <p>Complete your profile and start swiping to see your insights!</p>
                    <Link href="/onboarding" className="btn btn-primary">
                        Complete Profile →
                    </Link>
                </div>
            </div>
        );
    }

    const categoryValues = Object.values(summary.category_distribution);
    const maxCategory = categoryValues.length > 0 ? Math.max(...categoryValues) : 1;
    const categoryData = Object.entries(summary.category_distribution).map(([category, count]) => ({
        category,
        count,
        fullMark: maxCategory + 2,
    }));

    const mentorData = summary.top_interests.slice(0, 8).map((interest) => ({
        name: interest.name,
        mentors: interest.mentor_count ?? 0,
    }));

    // Identify the OTHER person on an active coffee match (never link to self!)
    const isRequester = coffeeMatch ? coffeeMatch.requester_id === currentUser.id : false;
    const partnerName = coffeeMatch
        ? (isRequester ? coffeeMatch.recipient_name : coffeeMatch.requester_name)
        : '';
    const partnerEmail = coffeeMatch
        ? (isRequester ? coffeeMatch.recipient_email : coffeeMatch.requester_email)
        : '';

    return (
        <div className="page">
            <Navbar />

            <main className="page-content">
                <div className="container">
                    {/* Active Coffee Match Banner OR Opt-in CTA */}
                    {coffeeMatch ? (
                        <motion.div
                            className={styles.matchBanner}
                            initial={{ opacity: 0, y: -16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div className={styles.matchBannerContent}>
                                <span className={styles.coffeeIcon} aria-hidden="true">☕</span>
                                <div className={styles.matchBannerText}>
                                    <h3>
                                        {coffeeMatch.status === 'accepted'
                                            ? 'You have an upcoming coffee chat!'
                                            : isRequester
                                                ? 'Coffee invite sent!'
                                                : 'Someone invited you for coffee!'}
                                    </h3>
                                    <p>
                                        {coffeeMatch.status === 'accepted' ? (
                                            <>Message <strong>{partnerName}</strong> on Teams to pick a time.</>
                                        ) : isRequester ? (
                                            <>Waiting for <strong>{partnerName}</strong> to respond to your coffee invite.</>
                                        ) : (
                                            <><strong>{partnerName}</strong> wants to grab a coffee — review it in Coffee Dates.</>
                                        )}
                                    </p>
                                </div>
                                {partnerEmail ? (
                                    <a
                                        href={getTeamsUrl(partnerEmail)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.teamsButton}
                                    >
                                        <svg className={styles.teamsIcon} viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                                            <path d="M19.419 11.83c-.84 0-1.521-.686-1.521-1.532a1.528 1.528 0 0 1 2.972-.497 1.53 1.53 0 0 1-1.451 2.029zM22.9 15.01c0 .58-.47 1.05-1.05 1.05h-2.03c-.58 0-1.05-.47-1.05-1.05v-2.77c0-.58.47-1.05 1.05-1.05h.62v-.59c0-.58.47-1.05 1.05-1.05h.36c.58 0 1.05.47 1.05 1.05v4.41zM14.6 6.76c0-1.29-1.04-2.33-2.33-2.33S9.94 5.47 9.94 6.76s1.04 2.33 2.33 2.33 2.33-1.04 2.33-2.33zM16.52 18.141c0 .58-.47 1.05-1.05 1.05H5.08c-.58 0-1.05-.47-1.05-1.05v-3.38c0-2.47 2.01-4.48 4.48-4.48h3.53c2.47 0 4.48 2.01 4.48 4.48v3.38z" />
                                        </svg>
                                        Message on Teams
                                    </a>
                                ) : (
                                    <Link href="/coffee-dates" className={styles.teamsButton}>
                                        View Coffee Dates →
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            className={styles.matchBanner}
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className={styles.matchBannerContent}>
                                <span className={styles.coffeeIcon} aria-hidden="true">☕</span>
                                <div className={styles.matchBannerText}>
                                    <h3>Ready for a spontaneous coffee chat?</h3>
                                    <p>Pair up automatically with a FreshMinds colleague who matches your learning goals.</p>
                                    {coffeeError && <p role="alert" style={{ marginTop: '0.35rem' }}>{coffeeError}</p>}
                                </div>
                                <button
                                    type="button"
                                    className={styles.teamsButton}
                                    onClick={handleFindCoffeeMatch}
                                    disabled={matchingCoffee}
                                >
                                    {matchingCoffee ? 'Finding match...' : '☕ Find Me a Coffee Match'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.header}
                    >
                        <h1>Your Activity &amp; Growth Insights</h1>
                        <p>Hey {currentUser.name}, here&apos;s an overview of your networking activity and learning goals.</p>
                    </motion.div>

                    {/* Stats Cards */}
                    <motion.div
                        className={styles.statsGrid}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="stat-card">
                            <div className="stat-value">{summary.total_swipes}</div>
                            <div className="stat-label">Colleagues Reviewed</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--success)' }}>
                                {summary.swipe_breakdown.right || 0}
                            </div>
                            <div className="stat-label">Connected</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--super)' }}>
                                {summary.super_likes}
                            </div>
                            <div className="stat-label">Super Likes</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--danger)' }}>
                                {summary.swipe_breakdown.left || 0}
                            </div>
                            <div className="stat-label">Passed</div>
                        </div>
                    </motion.div>

                    <div className={styles.chartsGrid}>
                        {/* Category Radar */}
                        <motion.div
                            className={styles.chartCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3>Learning Goals by Category</h3>
                            {categoryData.length > 0 ? (
                                <div className={styles.chartContainer}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <RadarChart data={categoryData}>
                                            <PolarGrid stroke="#E5E7EB" />
                                            <PolarAngleAxis dataKey="category" tick={{ fill: '#4B5563', fontSize: 12 }} />
                                            <PolarRadiusAxis
                                                angle={30}
                                                domain={[0, 'auto']}
                                                tick={{ fill: '#6B7280', fontSize: 10 }}
                                            />
                                            <Radar
                                                name="Growth Skills"
                                                dataKey="count"
                                                stroke="#2F45C2"
                                                fill="#2F45C2"
                                                fillOpacity={0.4}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <p className="text-muted">Add growth skills in your profile to see your category radar.</p>
                            )}
                        </motion.div>

                        {/* Mentors Available per Growth Skill */}
                        <motion.div
                            className={styles.chartCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h3>Available Mentors for Your Growth Skills</h3>
                            {mentorData.length > 0 ? (
                                <div className={styles.chartContainer}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={mentorData} layout="vertical">
                                            <XAxis type="number" allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={130}
                                                tick={{ fill: '#4B5563', fontSize: 12 }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: '#FFFFFF',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '6px',
                                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                                                    color: '#121212'
                                                }}
                                            />
                                            <Bar dataKey="mentors" name="Colleagues who can mentor" radius={[0, 4, 4, 0]}>
                                                {mentorData.map((_entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={COLORS[index % COLORS.length]}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <p className="text-muted">Add growth skills to see how many colleagues can mentor you.</p>
                            )}
                        </motion.div>
                    </div>

                    {/* Growth Skills List */}
                    <motion.div
                        className={styles.interestSection}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3>Your Learning Goals</h3>
                        {summary.top_interests.length > 0 ? (
                            <div className={styles.interestGrid}>
                                {summary.top_interests.map((interest, index) => (
                                    <div key={index} className={styles.interestCard}>
                                        <h4>{interest.name}</h4>
                                        <span className={styles.interestCategory}>{interest.category}</span>
                                        {typeof interest.mentor_count === 'number' && (
                                            <p className={styles.mentorMeta}>
                                                {interest.mentor_count}{' '}
                                                {interest.mentor_count === 1 ? 'colleague can help' : 'colleagues can help'}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted">
                                No learning goals selected yet.{' '}
                                <Link href="/profile">Update your profile</Link> to add skills you want to learn.
                            </p>
                        )}
                    </motion.div>

                    {/* CTA */}
                    <motion.div
                        className={styles.cta}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Link href="/swipe" className="btn btn-primary">
                            Continue Swiping →
                        </Link>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
