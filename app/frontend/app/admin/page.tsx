'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { Navbar } from '@/components/Navbar';
import { analyticsApi, usersApi, feedbackApi, SkillStats, User, Feedback } from '@/lib/api';
import { UNITS } from '@/lib/constants';
import { useCurrentUser } from '@/lib/user-context';
import styles from './admin.module.css';

const COLORS = ['#2F45C2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const LIGHT_TOOLTIP_STYLE = {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    color: '#121212',
};

export default function AdminPage() {
    const { authToken, isAdmin, loading: userLoading } = useCurrentUser();
    const [skillStats, setSkillStats] = useState<SkillStats[]>([]);
    const [unitDistribution, setUnitDistribution] = useState<Record<string, number>>({});
    const [trends, setTrends] = useState<{ name: string; category: string; interest_count: number }[]>([]);
    const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total_swipes: number; interested: number; super_interested: number }[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUnit, setSelectedUnit] = useState<string>('');

    useEffect(() => {
        if (userLoading || !isAdmin || !authToken) return;

        let active = true;

        const loadAnalytics = async () => {
            try {
                const results = await Promise.allSettled([
                    analyticsApi.getOrgSkillStats(selectedUnit || undefined, authToken),
                    analyticsApi.getUnitDistribution(authToken),
                    analyticsApi.getTrendingSkills(10, authToken),
                    analyticsApi.getCategoryBreakdown(authToken),
                    usersApi.list(authToken),
                    feedbackApi.list(authToken),
                ]);
                if (!active) return;
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
            } catch (err) {
                console.error('Failed to load analytics:', err);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        loadAnalytics();
        return () => {
            active = false;
        };
    }, [selectedUnit, isAdmin, authToken, userLoading]);

    if (userLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Loading organization analytics...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⛔ Access Denied</h2>
                        <p>You do not have permission to view this page.</p>
                        <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Admin access is restricted.</p>
                        <Link href="/swipe" className="btn btn-primary mt-lg">
                            Go to Swipe
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Loading organization analytics...</p>
                </div>
            </div>
        );
    }

    const pieData = Object.entries(unitDistribution).map(([name, value]) => ({
        name,
        value,
    }));

    const totalUsers = Object.values(unitDistribution).reduce((a, b) => a + b, 0);
    const totalSkillLinks = skillStats.reduce((acc, s) => acc + s.total_swipes, 0);
    const avgDemandShare = skillStats.length > 0
        ? (skillStats.reduce((acc, s) => acc + s.interest_rate, 0) / skillStats.length).toFixed(1)
        : '0';

    return (
        <div className="page">
            <Navbar />

            <main className="page-content">
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.header}
                    >
                        <h1>Organization Analytics</h1>
                        <p>Skill supply vs. learning demand and distribution across FreshMinds teams.</p>
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
                            <div className="stat-value">{totalSkillLinks}</div>
                            <div className="stat-label">Skill Selections</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{skillStats.length}</div>
                            <div className="stat-label">Skills Tracked</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{avgDemandShare}%</div>
                            <div className="stat-label">Avg Learning Demand</div>
                        </div>
                    </motion.div>

                    {/* Filter */}
                    <motion.div
                        className={styles.filterBar}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                    >
                        <label htmlFor="admin-unit-filter">Filter Skill Stats by Unit:</label>
                        <select
                            id="admin-unit-filter"
                            className="form-input form-select"
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                            style={{ width: 'auto', minWidth: '220px' }}
                        >
                            <option value="">All Units</option>
                            {UNITS.map((unit) => (
                                <option key={unit.value} value={unit.value}>
                                    {unit.label}
                                </option>
                            ))}
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
                                            {pieData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={LIGHT_TOOLTIP_STYLE} />
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
                            <h3>Trending Learning Goals</h3>
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={trends} layout="vertical">
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={130}
                                            tick={{ fill: '#4B5563', fontSize: 12 }}
                                        />
                                        <Tooltip contentStyle={LIGHT_TOOLTIP_STYLE} />
                                        <Bar dataKey="interest_count" name="Growth Goals" fill="#2F45C2" radius={[0, 4, 4, 0]} />
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
                        <h3>Skills Activity by Category</h3>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={categoryBreakdown}>
                                    <XAxis dataKey="category" tick={{ fill: '#4B5563', fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fill: '#4B5563', fontSize: 12 }} />
                                    <Tooltip contentStyle={LIGHT_TOOLTIP_STYLE} />
                                    <Legend />
                                    <Bar dataKey="interested" name="Want to Learn (Demand)" fill="#2F45C2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Skills Supply vs Demand Table */}
                    <motion.div
                        className={styles.tableCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <h3>Skill Supply vs. Learning Demand {selectedUnit ? `(${selectedUnit})` : ''}</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Skill</th>
                                        <th>Category</th>
                                        <th>Current Experts (Supply)</th>
                                        <th>Want to Learn (Demand)</th>
                                        <th>Total Selections</th>
                                        <th>Demand Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {skillStats.map((skill) => {
                                        const supply = skill.supply ?? skill.left_swipes;
                                        const demand = skill.demand ?? skill.right_swipes;
                                        return (
                                            <tr key={skill.id}>
                                                <td className={styles.skillName}>{skill.name}</td>
                                                <td>
                                                    <span className={styles.categoryBadge}>{skill.category}</span>
                                                </td>
                                                <td className={styles.interested}>{supply}</td>
                                                <td className={styles.super}>{demand}</td>
                                                <td>{skill.total_swipes}</td>
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
                                        );
                                    })}
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
                                            <td style={{ opacity: 0.8 }}>{user.email || 'Hidden'}</td>
                                            <td>
                                                <span className={styles.categoryBadge}>{user.unit || 'N/A'}</span>
                                            </td>
                                            <td>{user.seniority || 'N/A'}</td>
                                            <td style={{ opacity: 0.7 }}>
                                                {user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString()
                                                    : 'N/A'}
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
                                        <th>Page</th>
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
                                            <td>{item.category || 'General'}</td>
                                            <td style={{ opacity: 0.7 }}>{item.page || '-'}</td>
                                            <td>{item.rating ?? '-'}</td>
                                            <td style={{ maxWidth: 420 }}>{item.message}</td>
                                        </tr>
                                    ))}
                                    {feedback.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ opacity: 0.7 }}>
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
