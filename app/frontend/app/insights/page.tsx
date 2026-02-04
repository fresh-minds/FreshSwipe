'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
import { analyticsApi, UserSummary, coffeeDatesApi, CoffeeDate } from '@/lib/api';
import { ADMIN_EMAIL } from '@/lib/constants';
import styles from './insights.module.css';

const COLORS = ['#2F45C2', '#5467D5', '#7C8DEB', '#D1D1FF', '#E5E5FF'];

export default function InsightsPage() {
    const { data: session, status } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const router = useRouter();
    const [summary, setSummary] = useState<UserSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [coffeeMatch, setCoffeeMatch] = useState<CoffeeDate | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Generate Microsoft Teams chat URL
    const getTeamsUrl = (email: string) => {
        return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`;
    };

    useEffect(() => {
        const userId = localStorage.getItem('freshswipe_user_id');
        const name = localStorage.getItem('freshswipe_user_name');
        const localEmail = localStorage.getItem('freshswipe_user_email');

        // Check admin status
        if (session?.user?.email === ADMIN_EMAIL || localEmail === ADMIN_EMAIL) {
            setIsAdmin(true);
        }

        if (!userId) {
            router.push('/onboarding');
            return;
        }

        setUserName(name || 'User');

        // Fetch user summary
        analyticsApi.getUserSummary(userId, authToken as string | undefined)
            .then(data => {
                setSummary(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to load insights:', err);
                setIsLoading(false);
            });

        if (status === 'loading') return;
        // Ensure at least one coffee match exists; show it in banner
        coffeeDatesApi.autoMatch(authToken as string | undefined)
            .then(match => {
                setCoffeeMatch(match);
            })
            .catch(err => {
                console.error('Failed to auto-match coffee date:', err);
            });
    }, [router, session, status, authToken]);

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Loading your insights...</p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className={styles.emptyContainer}>
                <h2>No Data Yet</h2>
                <p>Start swiping to see your insights!</p>
                <Link href="/swipe" className="btn btn-primary">
                    Start Swiping →
                </Link>
            </div>
        );
    }

    // Prepare chart data
    const categoryData = Object.entries(summary.category_distribution).map(([category, count]) => ({
        category,
        count,
        fullMark: Math.max(...Object.values(summary.category_distribution)) + 2,
    }));

    const interestData = summary.top_interests.slice(0, 8).map((interest, index) => ({
        name: interest.name,
        value: interest.is_super ? 2 : 1,
        isSuper: interest.is_super,
    }));

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
                            <Link href="/swipe" className="nav-link">Swipe</Link>
                            <Link href="/insights" className="nav-link active">Insights</Link>
                            {isAdmin && <Link href="/admin" className="nav-link">Admin</Link>}
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container">
                    {/* Coffee Match Banner */}
                    {coffeeMatch && (
                        <motion.div
                            className={styles.matchBanner}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.5, type: "spring" }}
                        >
                            <div className={styles.matchBannerContent}>
                                <span className={styles.coffeeIcon}>☕</span>
                                <div className={styles.matchBannerText}>
                                    <h3>
                                        {coffeeMatch.status === 'accepted'
                                            ? 'You matched with someone for coffee!'
                                            : 'We found you a coffee match!'}
                                    </h3>
                                    <p>
                                        {coffeeMatch.status === 'accepted'
                                            ? (
                                                <>Send <strong>{coffeeMatch.requester_name || coffeeMatch.recipient_name}</strong> a message to set up your coffee chat.</>
                                            )
                                            : (
                                                <>We sent a coffee request to <strong>{coffeeMatch.recipient_name}</strong>. You can ping them on Teams.</>
                                            )}
                                    </p>
                                </div>
                                {(coffeeMatch.requester_email || coffeeMatch.recipient_email) && (
                                    <a
                                        href={getTeamsUrl(coffeeMatch.requester_email || coffeeMatch.recipient_email)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.teamsButton}
                                    >
                                        <svg className={styles.teamsIcon} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                            <path d="M19.419 11.83c-.84 0-1.521-.686-1.521-1.532a1.528 1.528 0 0 1 2.972-.497 1.53 1.53 0 0 1-1.451 2.029zM22.9 15.01c0 .58-.47 1.05-1.05 1.05h-2.03c-.58 0-1.05-.47-1.05-1.05v-2.77c0-.58.47-1.05 1.05-1.05h.62v-.59c0-.58.47-1.05 1.05-1.05h.36c.58 0 1.05.47 1.05 1.05v4.41zM14.6 6.76c0-1.29-1.04-2.33-2.33-2.33S9.94 5.47 9.94 6.76s1.04 2.33 2.33 2.33 2.33-1.04 2.33-2.33zM16.52 18.141c0 .58-.47 1.05-1.05 1.05H5.08c-.58 0-1.05-.47-1.05-1.05v-3.38c0-2.47 2.01-4.48 4.48-4.48h3.53c2.47 0 4.48 2.01 4.48 4.48v3.38z" />
                                        </svg>
                                        Message on Teams
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.header}
                    >
                        <h1>Your Skill Insights</h1>
                        <p>Hey {userName}, here&apos;s what your swipes say about your interests.</p>
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
                            <div className="stat-label">Total Swipes</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--success)' }}>
                                {summary.swipe_breakdown.right || 0}
                            </div>
                            <div className="stat-label">Interested</div>
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
                            <h3>Interest by Category</h3>
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={categoryData}>
                                        <PolarGrid stroke="#E5E7EB" />
                                        <PolarAngleAxis dataKey="category" tick={{ fill: '#4B5563', fontSize: 12 }} />
                                        <PolarRadiusAxis
                                            angle={30}
                                            domain={[0, 'auto']}
                                            tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                        />
                                        <Radar
                                            name="Interest"
                                            dataKey="count"
                                            stroke="#2F45C2"
                                            fill="#2F45C2"
                                            fillOpacity={0.4}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Top Interests */}
                        <motion.div
                            className={styles.chartCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h3>Top Interests</h3>
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={interestData} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={100}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
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
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {interestData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isSuper ? '#f59e0b' : COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>

                    {/* Interest List */}
                    <motion.div
                        className={styles.interestSection}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3>Your Skill Interests</h3>
                        <div className={styles.interestGrid}>
                            {summary.top_interests.map((interest, index) => (
                                <div
                                    key={index}
                                    className={`${styles.interestCard} ${interest.is_super ? styles.superInterest : ''}`}
                                >
                                    {interest.is_super && <span className={styles.superBadge}>⭐</span>}
                                    <h4>{interest.name}</h4>
                                    <span className={styles.interestCategory}>{interest.category}</span>
                                </div>
                            ))}
                        </div>
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
