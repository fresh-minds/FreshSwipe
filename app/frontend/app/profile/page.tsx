'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UNITS, SENIORITY_LEVELS } from '@/lib/constants';
import { skillsApi } from '@/lib/api';
import SkillSelector from '@/components/SkillSelector';
import styles from './profile.module.css';

export default function ProfilePage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const authToken = (session as any)?.idToken || session?.accessToken;
    const [profile, setProfile] = useState<any>(null);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const fetchData = async () => {
        try {
            // Fetch User Profile
            const res = await fetch('/api/v1/users/me', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const userData = await res.json();

            // Transform API response to state (extract IDs)
            const currentIds = userData.current_skills?.map((s: any) => s.skill_id) || [];
            const growthIds = userData.growth_skills?.map((s: any) => s.skill_id) || [];

            setProfile({
                ...userData,
                current_skills: currentIds,
                growth_skills: growthIds
            });

            // Fetch Available Skills
            const skills = await skillsApi.getAll();
            setAvailableSkills(skills);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Payload needs to match UserUpdate schema
            const payload = {
                name: profile.name,
                unit: profile.unit,
                seniority: profile.seniority,
                availability: profile.availability,
                is_searchable: profile.is_searchable,
                show_email: profile.show_email,
                current_skills: profile.current_skills,
                growth_skills: profile.growth_skills
            };

            await fetch('/api/v1/users/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(payload)
            });
            alert('Profile updated successfully!');
            router.push('/');
        } catch (err) {
            console.error("Update failed", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className={styles.loading}>Loading profile...</div>;

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
                            <span className="text-secondary">Hi, {session?.user?.name || 'User'}</span>
                            <Link href="/insights" className="nav-link">My Insights</Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className={styles.container}>
                    <form onSubmit={handleUpdate} className={styles.formCard}>
                        <h1 className={styles.title}>Your Profile</h1>

                        {/* Basic Info Section */}
                        <div className={styles.sectionHeader}>
                            <h2>Basic Information</h2>
                        </div>

                        <div className={styles.field}>
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={profile?.name || ''}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                            />
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Unit</label>
                                <select
                                    value={profile?.unit || 'Staff'}
                                    onChange={e => setProfile({ ...profile, unit: e.target.value })}
                                >
                                    {UNITS.map(unit => (
                                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Seniority</label>
                                <select
                                    value={profile?.seniority || ''}
                                    onChange={e => setProfile({ ...profile, seniority: e.target.value })}
                                >
                                    <option value="">Select Level</option>
                                    {SENIORITY_LEVELS.map(level => (
                                        <option key={level.value} value={level.value}>{level.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Skills Section */}
                        <div className={styles.sectionHeader}>
                            <h2>Skills & Growth</h2>
                            <p>This is what drives your matches! Be honest about what you know and what you want to learn.</p>
                        </div>

                        <SkillSelector
                            title="My Expertise (Current Skills)"
                            description="Skills you are proficient in and can mentor others on."
                            availableSkills={availableSkills}
                            selectedSkillIds={profile?.current_skills || []}
                            onChange={(ids: string[]) => setProfile({ ...profile, current_skills: ids })}
                        />

                        <SkillSelector
                            title="My Learning Goals (Growth Skills)"
                            description="Skills you want to learn or improve. We'll match you with experts."
                            availableSkills={availableSkills}
                            selectedSkillIds={profile?.growth_skills || []}
                            onChange={(ids: string[]) => setProfile({ ...profile, growth_skills: ids })}
                        />

                        {/* Preferences */}
                        <div className={styles.sectionHeader}>
                            <h2>Preferences</h2>
                        </div>

                        <div className={styles.field}>
                            <label>Availability</label>
                            <input
                                type="text"
                                placeholder="e.g. 1h/week, ad-hoc, monthly"
                                value={profile?.availability || ''}
                                onChange={e => setProfile({ ...profile, availability: e.target.value })}
                            />
                        </div>

                        <div className={styles.toggleField}>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={profile?.is_searchable}
                                    onChange={e => setProfile({ ...profile, is_searchable: e.target.checked })}
                                />
                                <span className={styles.slider}></span>
                            </label>
                            <span>Visible in matching</span>
                        </div>

                        <div className={styles.toggleField}>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={profile?.show_email}
                                    onChange={e => setProfile({ ...profile, show_email: e.target.checked })}
                                />
                                <span className={styles.slider}></span>
                            </label>
                            <span>Show email to matches</span>
                        </div>

                        <button type="submit" className={styles.saveButton} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
