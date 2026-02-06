'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        const fetchUser = async () => {
            try {
                const data = await usersApi.getById(userId, authToken);
                setUser(data);
            } catch (err) {
                console.error("Failed to fetch user details", err);
                setError("Could not load profile");
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUser();
        }
    }, [userId, authToken]);

    // Construct email content
    const emailSubject = encodeURIComponent("Coffee Chat? ☕");
    const emailBody = user ? encodeURIComponent(`Hi ${user.name},\n\nI saw your profile on FreshSwipe and noticed we have compatible skills! Would you be open to grabbing a virtual or in-person coffee sometime?\n\nBest,`) : "";

    return (
        <AnimatePresence>
            <div className={styles.overlay} onClick={onClose}>
                <motion.div
                    className={styles.modal}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">✕</button>

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
                                <h2 className={styles.name}>{user.name}</h2>
                                <p className={styles.role}>{user.seniority ? `${user.seniority} • ` : ''}{user.unit}</p>
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
                                        {user.current_skills.length === 0 && <span className={styles.role}>No skills listed</span>}
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
                                        {user.growth_skills.length === 0 && <span className={styles.role}>No interests listed</span>}
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
                                <button
                                    className={`${styles.actionButton} ${styles.primaryAction}`}
                                    onClick={() => {
                                        if (user.email) {
                                            window.open(`https://teams.microsoft.com/l/chat/0/0?users=${user.email}`, '_blank');
                                        } else {
                                            alert("No email available for Teams");
                                        }
                                    }}
                                >
                                    💬 Teams Chat
                                </button>

                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
