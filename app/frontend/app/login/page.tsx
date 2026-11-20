'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Image from 'next/image';
import styles from './login.module.css';

const ERROR_MESSAGES: Record<string, string> = {
    CredentialsSignin: 'Invalid admin email or password.',
    OAuthSignin: 'Could not start Microsoft sign-in. Please try again.',
    OAuthCallback: 'Microsoft sign-in failed. Please try again.',
    SessionExpired: 'Your session expired. Please sign in again.',
    AccessDenied: 'Access denied. Please contact an administrator.',
};

function sanitizeCallbackUrl(raw: string | null): string {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
        return '/';
    }
    return raw;
}

function LoginForm() {
    const searchParams = useSearchParams();
    const showAdmin = searchParams.get('admin') === 'true';
    const errorCode = searchParams.get('error');
    const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
    const [submitting, setSubmitting] = useState<'azure' | 'credentials' | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const displayError =
        formError ||
        (errorCode ? ERROR_MESSAGES[errorCode] || 'Sign-in failed. Please try again.' : null);

    const handleMicrosoftSignIn = async () => {
        setSubmitting('azure');
        setFormError(null);
        await signIn('azure-ad', { callbackUrl });
    };

    const handleAdminSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting('credentials');
        setFormError(null);

        const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
        const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;

        const res = await signIn('credentials', {
            email,
            password,
            callbackUrl,
            redirect: false,
        });

        if (res?.error) {
            setFormError(ERROR_MESSAGES.CredentialsSignin);
            setSubmitting(null);
            return;
        }
        window.location.href = res?.url || callbackUrl;
    };

    return (
        <div className={`${styles.container} bg-dots`}>
            <div className={styles.card}>
                <div className={styles.logoWrap}>
                    <Image src="/logo.png" alt="FreshSwipe Logo" width={48} height={48} priority />
                </div>
                <h1 className={styles.title}>FreshSwipe</h1>
                <p className={styles.subtitle}>
                    Connect with colleagues, find mentors, and grow your skills at FreshMinds.
                </p>

                {displayError && (
                    <div className={styles.errorBanner} role="alert">
                        {displayError}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleMicrosoftSignIn}
                    className={styles.loginButton}
                    disabled={submitting !== null}
                >
                    <svg className={styles.msIcon} viewBox="0 0 23 23" aria-hidden="true">
                        <path fill="#f3f3f3" d="M0 0h11.5v11.5H0z" />
                        <path fill="#f3f3f3" d="M11.5 0H23v11.5H11.5z" />
                        <path fill="#f3f3f3" d="M0 11.5h11.5V23H0z" />
                        <path fill="#f3f3f3" d="M11.5 11.5H23V23H11.5z" />
                    </svg>
                    {submitting === 'azure' ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
                </button>

                {showAdmin && (
                    <>
                        <div className={styles.divider}>
                            <span>OR</span>
                        </div>

                        <form onSubmit={handleAdminSubmit} className={styles.adminForm}>
                            <input
                                name="email"
                                type="email"
                                placeholder="admin@freshminds.nl"
                                className={styles.input}
                                autoComplete="username"
                                required
                                disabled={submitting !== null}
                            />
                            <input
                                name="password"
                                type="password"
                                placeholder="Password"
                                className={styles.input}
                                autoComplete="current-password"
                                required
                                disabled={submitting !== null}
                            />
                            <button
                                type="submit"
                                className={`${styles.loginButton} ${styles.adminButton}`}
                                disabled={submitting !== null}
                            >
                                {submitting === 'credentials' ? 'Signing in...' : 'Login as Admin'}
                            </button>
                        </form>
                    </>
                )}

                <div className={styles.footer}>
                    Internal use only. Powered by FreshMinds Entra ID.
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className={styles.container}>Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
