'use client';

import { signIn } from 'next-auth/react';
import styles from './login.module.css';

export default function LoginPage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>FreshSwipe v2</h1>
                <p className={styles.subtitle}>
                    Connect with colleagues, find mentors, and grow your skills at FreshMinds.
                </p>

                <button
                    onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
                    className={styles.loginButton}
                >
                    <svg className={styles.msIcon} viewBox="0 0 23 23">
                        <path fill="#f3f3f3" d="M0 0h11.5v11.5H0z" />
                        <path fill="#f3f3f3" d="M11.5 0H23v11.5H11.5z" />
                        <path fill="#f3f3f3" d="M0 11.5h11.5V23H0z" />
                        <path fill="#f3f3f3" d="M11.5 11.5H23V23H11.5z" />
                    </svg>
                    Sign in with Microsoft
                </button>

                <div className={styles.divider}>
                    <span>OR</span>
                </div>

                <form onSubmit={(e) => {
                    e.preventDefault();
                    signIn('credentials', {
                        email: (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value,
                        password: (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value,
                        callbackUrl: '/'
                    });
                }} className={styles.adminForm}>
                    <input
                        name="email"
                        type="email"
                        placeholder="admin@admin.com"
                        className={styles.input}
                        required
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Password"
                        className={styles.input}
                        required
                    />
                    <button type="submit" className={`${styles.loginButton} ${styles.adminButton}`}>
                        Login as Admin
                    </button>
                </form>

                <div className={styles.footer}>
                    Internal use only. Powered by FreshMinds Entra ID.
                </div>
            </div>
        </div>
    );
}
