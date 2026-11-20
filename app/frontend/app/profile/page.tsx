'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { UNITS, SENIORITY_LEVELS } from '@/lib/constants';
import { skillsApi, usersApi, matchesApi, Skill } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import SkillSelector from '@/components/SkillSelector';
import styles from './profile.module.css';

interface ProfileFormState {
    name: string;
    unit: string;
    seniority: string;
    availability: string;
    is_searchable: boolean;
    show_email: boolean;
    current_skills: string[];
    growth_skills: string[];
}

export default function ProfilePage() {
    const router = useRouter();
    const { currentUser, authToken, loading: userLoading, refreshUser } = useCurrentUser();
    const [profile, setProfile] = useState<ProfileFormState | null>(null);
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [showMatchPopup, setShowMatchPopup] = useState(false);

    useEffect(() => {
        let active = true;

        const init = async () => {
            if (userLoading) return;
            try {
                const skills = await skillsApi.getAll();
                if (!active) return;
                setAvailableSkills(skills);

                if (currentUser) {
                    setProfile({
                        name: currentUser.name || '',
                        unit: currentUser.unit || 'Staff',
                        seniority: currentUser.seniority || '',
                        availability: currentUser.availability || '',
                        is_searchable: Boolean(currentUser.is_searchable ?? true),
                        show_email: Boolean(currentUser.show_email ?? true),
                        current_skills: currentUser.current_skills.map((s) => s.skill_id),
                        growth_skills: currentUser.growth_skills.map((s) => s.skill_id),
                    });
                } else {
                    setError('Could not load your profile. Please refresh and try again.');
                }
            } catch (err) {
                console.error('Failed to fetch profile data:', err);
                if (active) setError('Could not load your profile. Please try again.');
            } finally {
                if (active) setLoading(false);
            }
        };

        init();
        return () => {
            active = false;
        };
    }, [currentUser, userLoading]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !authToken) return;

        setSaving(true);
        setError(null);
        setSavedMessage(null);

        try {
            await usersApi.updateMe(
                {
                    name: profile.name.trim(),
                    unit: profile.unit,
                    seniority: profile.seniority || null,
                    availability: profile.availability.trim() || null,
                    is_searchable: profile.is_searchable,
                    show_email: profile.show_email,
                    current_skills: profile.current_skills,
                    growth_skills: profile.growth_skills,
                },
                authToken
            );

            await refreshUser();

            const matches = await matchesApi.list(undefined, 1, authToken).catch(() => []);
            if (matches.length > 0) {
                setShowMatchPopup(true);
            } else {
                setSavedMessage('Profile updated successfully!');
            }
        } catch (err) {
            console.error('Update failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to save your profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading || userLoading) {
        return (
            <div className="page">
                <Navbar />
                <div className={styles.loading}>Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="page">
            {showMatchPopup && (
                <div
                    className={styles.modalOverlay}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="profile-saved-title"
                >
                    <div className={styles.modalContent}>
                        <h2 id="profile-saved-title">Profile Saved! 🎯</h2>
                        <p>We found potential coffee dates based on your updated skills!</p>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => router.push('/matches')}
                            >
                                View Matches
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setShowMatchPopup(false)}
                            >
                                Stay on Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Navbar />

            <main className="page-content">
                <div className={styles.container}>
                    {!profile ? (
                        <div className={styles.formCard} role="alert">
                            <p>{error || 'Profile unavailable.'}</p>
                            <button
                                type="button"
                                className={styles.saveButton}
                                onClick={() => refreshUser()}
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className={styles.formCard}>
                            <h1 className={styles.title}>Your Profile</h1>

                            {error && (
                                <div className={styles.errorBanner} role="alert">
                                    {error}
                                </div>
                            )}
                            {savedMessage && (
                                <div className={styles.successBanner} role="status">
                                    {savedMessage}
                                </div>
                            )}

                            <div className={styles.sectionHeader}>
                                <h2>Basic Information</h2>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="profile-name">Display Name</label>
                                <input
                                    id="profile-name"
                                    type="text"
                                    value={profile.name}
                                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label htmlFor="profile-unit">Unit</label>
                                    <select
                                        id="profile-unit"
                                        value={profile.unit}
                                        onChange={e => setProfile({ ...profile, unit: e.target.value })}
                                    >
                                        {UNITS.map(unit => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label htmlFor="profile-seniority">Seniority</label>
                                    <select
                                        id="profile-seniority"
                                        value={profile.seniority}
                                        onChange={e => setProfile({ ...profile, seniority: e.target.value })}
                                    >
                                        <option value="">Select Level</option>
                                        {SENIORITY_LEVELS.map(level => (
                                            <option key={level.value} value={level.value}>{level.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.sectionHeader}>
                                <h2>Skills &amp; Growth</h2>
                                <p>This is what drives your matches! Share what you know and what you want to learn.</p>
                            </div>

                            <SkillSelector
                                title="My Expertise (Current Skills)"
                                description="Skills you are proficient in and can mentor others on."
                                availableSkills={availableSkills}
                                selectedSkillIds={profile.current_skills}
                                onChange={(ids: string[]) => setProfile({ ...profile, current_skills: ids })}
                            />

                            <SkillSelector
                                title="My Learning Goals (Growth Skills)"
                                description="Skills you want to learn or improve. We'll match you with experts."
                                availableSkills={availableSkills}
                                selectedSkillIds={profile.growth_skills}
                                onChange={(ids: string[]) => setProfile({ ...profile, growth_skills: ids })}
                            />

                            <div className={styles.sectionHeader}>
                                <h2>Preferences &amp; Privacy</h2>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="profile-availability">Availability</label>
                                <input
                                    id="profile-availability"
                                    type="text"
                                    placeholder="e.g. 1h/week, ad-hoc, monthly"
                                    value={profile.availability}
                                    onChange={e => setProfile({ ...profile, availability: e.target.value })}
                                />
                            </div>

                            <div className={styles.toggleField}>
                                <label className={styles.switch} htmlFor="profile-searchable">
                                    <input
                                        id="profile-searchable"
                                        type="checkbox"
                                        checked={profile.is_searchable}
                                        onChange={e => setProfile({ ...profile, is_searchable: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                                <label htmlFor="profile-searchable" className={styles.toggleText}>
                                    Visible in colleague matching &amp; FreshBot
                                </label>
                            </div>

                            <div className={styles.toggleField}>
                                <label className={styles.switch} htmlFor="profile-show-email">
                                    <input
                                        id="profile-show-email"
                                        type="checkbox"
                                        checked={profile.show_email}
                                        onChange={e => setProfile({ ...profile, show_email: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                                <label htmlFor="profile-show-email" className={styles.toggleText}>
                                    Show email to matches (enables Teams &amp; Outlook shortcuts)
                                </label>
                            </div>

                            <button type="submit" className={styles.saveButton} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
