'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Navbar } from '@/components/Navbar';
import { analyticsApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './team-trends.module.css';

const COLORS = ['#2F45C2', '#3B56D8', '#5467D5', '#7C8DEB', '#A5B4FC'];

type Trend = { name: string; category: string; interest_count: number };
type CategoryBreakdown = { category: string; total_swipes: number; interested: number; super_interested: number };

export default function TeamTrendsPage() {
    const { authToken, isAdmin, sessionStatus } = useCurrentUser();
    const [trends, setTrends] = useState<Trend[]>([]);
    const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (sessionStatus !== 'authenticated' || !authToken) return;
        let active = true;

        const loadTrends = async () => {
            try {
                const [trendData, categoryData] = await Promise.all([
                    analyticsApi.getTrendingSkills(10, authToken),
                    analyticsApi.getCategoryBreakdown(authToken),
                ]);
                if (!active) return;
                setTrends(trendData);
                setCategories(categoryData);
                setError(null);
            } catch (err) {
                console.error('Failed to load team trends:', err);
                if (active) setError('Unable to load organization trends right now.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadTrends();
        return () => {
            active = false;
        };
    }, [authToken, sessionStatus]);

    return (
        <div className="page">
            <Navbar />

            <main className="page-content">
                <div className="container">
                    <div className={styles.header}>
                        <h1>Team Trends</h1>
                        <p>Organization-wide learning trends based on colleagues&apos; growth skills.</p>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Loading trends…</div>
                    ) : error ? (
                        <div className={styles.loading} role="alert">{error}</div>
                    ) : (
                        <>
                            <div className={styles.grid}>
                                <div className={styles.chartCard}>
                                    <h3>Top Skills Colleagues Want to Learn</h3>
                                    <div className={styles.chart}>
                                        {trends.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={320}>
                                                <BarChart data={trends} layout="vertical">
                                                    <XAxis type="number" allowDecimals={false} />
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
                                                            color: '#121212',
                                                        }}
                                                    />
                                                    <Bar dataKey="interest_count" name="Colleagues learning" radius={[0, 4, 4, 0]}>
                                                        {trends.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted">No trend data yet.</p>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.chartCard}>
                                    <h3>Learning Interest by Category</h3>
                                    <div className={styles.chart}>
                                        {categories.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={320}>
                                                <BarChart data={categories}>
                                                    <XAxis dataKey="category" tick={{ fill: '#475569', fontSize: 12 }} />
                                                    <YAxis allowDecimals={false} tick={{ fill: '#475569', fontSize: 12 }} />
                                                    <Tooltip
                                                        contentStyle={{
                                                            background: '#ffffff',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            color: '#121212',
                                                        }}
                                                    />
                                                    <Bar dataKey="interested" name="Growth Goals" fill="#2F45C2" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted">No category breakdown available yet.</p>
                                        )}
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
