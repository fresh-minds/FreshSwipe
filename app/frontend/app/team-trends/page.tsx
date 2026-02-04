'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyticsApi } from '@/lib/api';
import styles from './team-trends.module.css';

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const ADMIN_EMAIL = 'karel.goense@freshminds.nl';

type Trend = { name: string; category: string; interest_count: number };
type CategoryBreakdown = { category: string; total_swipes: number; interested: number; super_interested: number };

export default function TeamTrendsPage() {
    const { data: session } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [isAdmin, setIsAdmin] = useState(false);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const localEmail = localStorage.getItem('freshswipe_user_email');
        const sessionEmail = session?.user?.email;
        const userEmail = sessionEmail || localEmail;
        setIsAdmin(userEmail === ADMIN_EMAIL);
    }, [session]);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            analyticsApi.getTrendingSkills(10, authToken as string | undefined),
            analyticsApi.getCategoryBreakdown(authToken as string | undefined),
        ])
            .then(([trendData, categoryData]) => {
                setTrends(trendData);
                setCategories(categoryData);
            })
            .catch((err) => {
                console.error('Failed to load team trends:', err);
            })
            .finally(() => setLoading(false));
    }, [authToken]);

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
                            <Link href="/insights" className="nav-link">Insights</Link>
                            <Link href="/team-trends" className="nav-link active">Team Trends</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container">
                    <div className={styles.header}>
                        <h1>Team Trends</h1>
                        <p>Organization-wide interest trends based on swipe activity.</p>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Loading trends…</div>
                    ) : (
                        <>
                            <div className={styles.grid}>
                                <div className={styles.chartCard}>
                                    <h3>Trending Skills</h3>
                                    <div className={styles.chart}>
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart data={trends} layout="vertical">
                                                <XAxis type="number" />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={140}
                                                    tick={{ fill: '#475569', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                    }}
                                                />
                                                <Bar dataKey="interest_count" radius={[0, 4, 4, 0]}>
                                                    {trends.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className={styles.chartCard}>
                                    <h3>Interest by Category</h3>
                                    <div className={styles.chart}>
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart data={categories}>
                                                <XAxis dataKey="category" tick={{ fill: '#475569', fontSize: 12 }} />
                                                <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                    }}
                                                />
                                                <Bar dataKey="interested" name="Interested" fill="#22c55e" stackId="a" />
                                                <Bar dataKey="super_interested" name="Super Interested" fill="#f59e0b" stackId="a" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.adminCta}>
                                {isAdmin ? (
                                    <Link href="/admin" className="btn btn-primary">
                                        Open Admin Analytics →
                                    </Link>
                                ) : (
                                    <span className="text-muted">
                                        Want deeper org analytics? Ask an admin for access.
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
