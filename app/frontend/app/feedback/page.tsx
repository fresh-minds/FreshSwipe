'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { feedbackApi } from '@/lib/api';
import styles from './feedback.module.css';

const CATEGORIES = [
    'Bug',
    'UI/UX',
    'Performance',
    'Feature Request',
    'Staff',
];

export default function FeedbackPage() {
    const { data: session } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState<number | ''>('');
    const [category, setCategory] = useState<string>('Staff');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            await feedbackApi.create({
                message,
                rating: rating === '' ? undefined : rating,
                category,
                page: typeof window !== 'undefined' ? window.location.pathname : undefined,
            }, authToken as string | undefined);
            setSuccess(true);
            setMessage('');
            setRating('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

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
                            <Link href="/feedback" className="nav-link active">Feedback</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container container-md">
                    <div className={styles.card}>
                        <h1>Share Feedback</h1>
                        <p className="text-muted">Help us improve FreshSwipe with your thoughts.</p>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <label className={styles.label}>Category</label>
                            <select
                                className={styles.select}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>

                            <label className={styles.label}>Rating (optional)</label>
                            <div className={styles.ratingRow}>
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        type="button"
                                        key={value}
                                        className={`${styles.ratingBtn} ${rating === value ? styles.active : ''}`}
                                        onClick={() => setRating(value)}
                                    >
                                        {value}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className={`${styles.ratingBtn} ${rating === '' ? styles.active : ''}`}
                                    onClick={() => setRating('')}
                                >
                                    Clear
                                </button>
                            </div>

                            <label className={styles.label}>Feedback</label>
                            <textarea
                                className={styles.textarea}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="What should we improve?"
                                rows={6}
                                required
                            />

                            {error && <div className={styles.error}>{error}</div>}
                            {success && <div className={styles.success}>Thanks! Your feedback was sent.</div>}

                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? 'Submitting…' : 'Send Feedback'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
