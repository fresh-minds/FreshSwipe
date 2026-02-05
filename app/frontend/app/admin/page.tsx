'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { analyticsApi, usersApi, feedbackApi, SkillStats, User, Feedback } from '@/lib/api';
import { ADMIN_EMAIL } from '@/lib/constants';
import styles from './admin.module.css';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [skillStats, setSkillStats] = useState<SkillStats[]>([]);
    const [unitDistribution, setUnitDistribution] = useState<Record<string, number>>({});
    const [trends, setTrends] = useState<{ name: string; category: string; interest_count: number }[]>([]);
    const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total_swipes: number; interested: number; super_interested: number }[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUnauthorized, setIsUnauthorized] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<string>('');

    useEffect(() => {
        // Check if user is authorized (admin only)
        // Check both session email and localStorage email
        const localEmail = localStorage.getItem('freshswipe_user_email');
        const sessionEmail = session?.user?.email;
        const userEmail = sessionEmail || localEmail;

        if (userEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.warn(`Unauthorized access attempt by: ${userEmail}. Expected: ${ADMIN_EMAIL}`);
            setIsUnauthorized(true);
            setIsLoading(false);
            return;
        }

        Promise.allSettled([
            analyticsApi.getOrgSkillStats(selectedUnit || undefined, authToken as string | undefined),
            analyticsApi.getUnitDistribution(authToken as string | undefined),
            analyticsApi.getTrendingSkills(10, authToken as string | undefined),
            analyticsApi.getCategoryBreakdown(authToken as string | undefined),
            usersApi.list(authToken as string | undefined),
            feedbackApi.list(authToken as string | undefined),
        ])
            .then((results) => {
                const [
                    skillsRes,
                    unitsRes,
                    trendingRes,
                    categoriesRes,
                    usersRes,
                    feedbackRes,
                ] = results;

                if (skillsRes.status === 'fulfilled') setSkillStats(skillsRes.value);
                if (unitsRes.status === 'fulfilled') setUnitDistribution(unitsRes.value);
                if (trendingRes.status === 'fulfilled') setTrends(trendingRes.value);
                if (categoriesRes.status === 'fulfilled') setCategoryBreakdown(categoriesRes.value);
                if (usersRes.status === 'fulfilled') setUsers(usersRes.value);
                if (feedbackRes.status === 'fulfilled') setFeedback(feedbackRes.value);

                if (feedbackRes.status === 'rejected') {
                    console.warn('Feedback list unavailable:', feedbackRes.reason);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to load analytics:', err);
                setIsLoading(false);
            });
    }, [selectedUnit, session, authToken]);

    // Unauthorized access - show message and redirect
    if (isUnauthorized) {
        return (
            <div className={styles.loadingContainer}>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⛔ Access Denied</h2>
                    <p>You do not have permission to view this page.</p>
                    <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Admin access is restricted.</p>
                    <Link href="/swipe" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                        Go to Swipe
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Loading organization analytics...</p>
            </div>
        );
    }

    // Prepare chart data
    const pieData = Object.entries(unitDistribution).map(([name, value]) => ({
        name,
        value,
    }));

    const totalUsers = Object.values(unitDistribution).reduce((a, b) => a + b, 0);
    const totalSwipes = skillStats.reduce((acc, s) => acc + s.total_swipes, 0);
    const avgInterestRate = skillStats.length > 0
        ? (skillStats.reduce((acc, s) => acc + s.interest_rate, 0) / skillStats.length).toFixed(1)
        : 0;

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
                            <Link href="/admin" className="nav-link active">Admin</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.header}
                    >
                        <h1>Organization Analytics</h1>
                        <p>Skill interest trends and distribution across teams.</p>
                    </motion.div>

                    {/* Overview Stats */}
                    <motion.div
                        className={styles.statsGrid}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="stat-card">
                            <div className="stat-value">{totalUsers}</div>
                            <div className="stat-label">Total Users</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{totalSwipes}</div>
                            <div className="stat-label">Total Swipes</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{skillStats.length}</div>
                            <div className="stat-label">Skills Tracked</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{avgInterestRate}%</div>
                            <div className="stat-label">Avg Interest Rate</div>
                        </div>
                    </motion.div>

                    {/* Filter */}
                    <motion.div
                        className={styles.filterBar}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                    >
                        <label>Filter by Unit:</label>
                        <select
                            className="form-input form-select"
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                            style={{ width: 'auto', minWidth: '200px' }}
                        >
                            <option value="">All Units</option>
                            <option value="Software">Software</option>
                            <option value="Data">Data</option>
                            <option value="Cloud">Cloud</option>
                            <option value="Security">Security</option>
                            <option value="Staff">Staff</option>
                        </select>
                    </motion.div>

                    <div className={styles.chartsRow}>
                        {/* Unit Distribution Pie */}
                        <motion.div
                            className={styles.chartCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3>User Distribution by Unit</h3>
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: '#1e293b',
                                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Trending Skills */}
                        <motion.div
                            className={styles.chartCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h3>Trending Skills</h3>
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={trends} layout="vertical">
                                        <XAxis type="number" />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={120}
                                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: '#1e293b',
                                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Bar dataKey="interest_count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>

                    {/* Category Breakdown */}
                    <motion.div
                        className={styles.chartCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3>Interest by Category</h3>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={categoryBreakdown}>
                                    <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#1e293b',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="interested" name="Interested" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="super_interested" name="Super Interested" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Skills Table */}
                    <motion.div
                        className={styles.tableCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <h3>Skill Statistics</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Skill</th>
                                        <th>Category</th>
                                        <th>Total Swipes</th>
                                        <th>Interested</th>
                                        <th>Super Likes</th>
                                        <th>Interest Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {skillStats.map((skill) => (
                                        <tr key={skill.id}>
                                            <td className={styles.skillName}>{skill.name}</td>
                                            <td>
                                                <span className={styles.categoryBadge}>{skill.category}</span>
                                            </td>
                                            <td>{skill.total_swipes}</td>
                                            <td className={styles.interested}>{skill.right_swipes}</td>
                                            <td className={styles.super}>{skill.super_swipes}</td>
                                            <td>
                                                <div className={styles.rateBar}>
                                                    <div
                                                        className={styles.rateFill}
                                                        style={{ width: `${skill.interest_rate}%` }}
                                                    />
                                                    <span>{skill.interest_rate}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Users Table */}
                    <motion.div
                        className={styles.tableCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <h3>👥 Registered Users ({users.length})</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Unit</th>
                                        <th>Seniority</th>
                                        <th>Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td className={styles.skillName}>{user.name}</td>
                                            <td style={{ opacity: 0.8 }}>{user.email}</td>
                                            <td>
                                                <span className={styles.categoryBadge}>{user.unit || 'N/A'}</span>
                                            </td>
                                            <td>{user.seniority || 'N/A'}</td>
                                            <td style={{ opacity: 0.7 }}>
                                                {user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString()
                                                    : 'N/A'
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Feedback Table */}
                    <motion.div
                        className={styles.tableCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <h3>📝 User Feedback ({feedback.length})</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Created</th>
                                        <th>User</th>
                                        <th>Category</th>
                                        <th>Rating</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {feedback.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ opacity: 0.7 }}>
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <div>{item.user_name}</div>
                                                <div style={{ opacity: 0.6, fontSize: '0.85em' }}>{item.user_email}</div>
                                            </td>
                                            <td>{item.category || 'Staff'}</td>
                                            <td>{item.rating ?? '-'}</td>
                                            <td style={{ maxWidth: 420 }}>{item.message}</td>
                                        </tr>
                                    ))}
                                    {feedback.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ opacity: 0.7 }}>
                                                No feedback submitted yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
