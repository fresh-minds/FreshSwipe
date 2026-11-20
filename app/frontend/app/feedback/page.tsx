'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { feedbackApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import styles from './feedback.module.css';

const CATEGORIES = [
    'General',
    'Bug',
    'UI/UX',
    'Performance',
    'Feature Request',
];

function FeedbackForm() {
    const searchParams = useSearchParams();
    const fromPage = searchParams.get('from');
    const { authToken } = useCurrentUser();
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState<number | ''>('');
    const [category, setCategory] = useState<string>('General');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            await feedbackApi.create(
                {
                    message: message.trim(),
                    rating: rating === '' ? undefined : rating,
                    category,
                    page: fromPage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
                },
                authToken
            );
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
        <div className={styles.card}>
            <h1>Share Feedback</h1>
            <p className="text-muted">
                Help us improve FreshSwipe with your thoughts.
                {fromPage && ` (About page: ${fromPage})`}
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
                <label htmlFor="feedback-category" className={styles.label}>Category</label>
                <select
                    id="feedback-category"
                    className={styles.select}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <span className={styles.label}>Rating (optional)</span>
                <div className={styles.ratingRow} role="group" aria-label="Rating out of 5">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            type="button"
                            key={value}
                            aria-pressed={rating === value}
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

                <label htmlFor="feedback-message" className={styles.label}>Feedback</label>
                <textarea
                    id="feedback-message"
                    className={styles.textarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What should we improve?"
                    rows={6}
                    required
                />

                {error && <div className={styles.error} role="alert">{error}</div>}
                {success && <div className={styles.success} role="status">Thanks! Your feedback was sent.</div>}

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Send Feedback'}
                </button>

                <div className={styles.divider}>
                    <span>or</span>
                </div>

                <a
                    href="https://github.com/fresh-minds/FreshSwipe/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.githubLink}
                >
                    Report a Bug / Technical Issue on GitHub ↗
                </a>
            </form>
        </div>
    );
}

export default function FeedbackPage() {
    return (
        <div className="page">
            <Navbar />
            <main className="page-content">
                <div className="container container-md">
                    <Suspense fallback={<div className={styles.card}>Loading...</div>}>
                        <FeedbackForm />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
