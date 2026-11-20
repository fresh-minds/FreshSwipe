'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserWithSkills, usersApi } from '@/lib/api';
import styles from './ProfileModal.module.css';

interface ProfileModalProps {
    userId: string;
    authToken?: string;
    onClose: () => void;
}

export default function ProfileModal({ userId, authToken, onClose }: ProfileModalProps) {
    const [user, setUser] = useState<UserWithSkills | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        let active = true;
        const fetchUser = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await usersApi.getById(userId, authToken);
                if (active) setUser(data);
            } catch (err) {
                console.error("Failed to fetch user details", err);
                if (active) setError("Could not load profile.");
            } finally {
                if (active) setLoading(false);
            }
        };

        if (userId) {
            fetchUser();
        }
        return () => {
            active = false;
        };
    }, [userId, authToken]);

    const calendarHref = user?.email
        ? `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent("Coffee Chat? ☕")}&body=${encodeURIComponent(`Hi ${user.name},\n\nI saw your profile on FreshSwipe and noticed we have compatible skills! Would you be open to grabbing a virtual or in-person coffee sometime?\n\nBest,`)}&to=${encodeURIComponent(user.email)}`
        : null;

    const teamsHref = user?.email
        ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(user.email)}`
        : null;

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
        >
            <motion.div
                className={styles.modal}
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    ✕
                </button>

                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>Loading profile...</p>
                    </div>
                ) : error || !user ? (
                    <div className={styles.loading}>
                        <p>{error || "User not found"}</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.header}>
                            <div className={styles.avatar}>
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <h2 id="profile-modal-title" className={styles.name}>{user.name}</h2>
                            <p className={styles.role}>
                                {user.seniority ? `${user.seniority} • ` : ''}{user.unit}
                            </p>
                        </div>

                        <div className={styles.content}>
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>Can help with</h3>
                                <div className={styles.chips}>
                                    {user.current_skills.map(skill => (
                                        <span key={skill.id} className={`${styles.chip} ${styles.chipPrimary}`}>
                                            {skill.skill_name}
                                        </span>
                                    ))}
                                    {user.current_skills.length === 0 && (
                                        <span className={styles.role}>No skills listed</span>
                                    )}
                                </div>
                            </div>

                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>Wants to learn</h3>
                                <div className={styles.chips}>
                                    {user.growth_skills.map(skill => (
                                        <span key={skill.id} className={`${styles.chip} ${styles.chipSecondary}`}>
                                            {skill.skill_name}
                                        </span>
                                    ))}
                                    {user.growth_skills.length === 0 && (
                                        <span className={styles.role}>No learning goals listed</span>
                                    )}
                                </div>
                            </div>

                            {user.availability && (
                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Availability</h3>
                                    <div className={styles.bio}>
                                        {user.availability}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.actions}>
                            {teamsHref ? (
                                <>
                                    <a
                                        href={teamsHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${styles.actionButton} ${styles.primaryAction}`}
                                    >
                                        💬 Teams Chat
                                    </a>
                                    {calendarHref && (
                                        <a
                                            href={calendarHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${styles.actionButton} ${styles.secondaryAction}`}
                                        >
                                            📅 Schedule
                                        </a>
                                    )}
                                </>
                            ) : (
                                <p className={styles.role}>
                                    This colleague has chosen to keep their email private.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
