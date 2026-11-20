'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { skillsApi, usersApi, Skill } from '@/lib/api';
import { UNITS, SENIORITY_LEVELS } from '@/lib/constants';
import { useCurrentUser } from '@/lib/user-context';
import styles from './onboarding.module.css';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { currentUser, authToken, refreshUser } = useCurrentUser();
    const [step, setStep] = useState<Step>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [ssoNameLocked, setSsoNameLocked] = useState(false);
    const [ssoEmailLocked, setSsoEmailLocked] = useState(false);
    const [isLoadingSkills, setIsLoadingSkills] = useState(true);
    const [hydratedFromProfile, setHydratedFromProfile] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        unit: '',
        seniority: '',
        availability: '',
        currentSkills: [] as string[],
        growthSkills: [] as string[],
    });

    // Pre-populate from existing backend user profile if available, falling back to SSO session
    useEffect(() => {
        if (currentUser && !hydratedFromProfile) {
            setFormData({
                name: currentUser.name || session?.user?.name || '',
                email: currentUser.email || session?.user?.email || '',
                unit: currentUser.unit || '',
                seniority: currentUser.seniority || '',
                availability: currentUser.availability || '',
                currentSkills: currentUser.current_skills.map((s) => s.skill_id),
                growthSkills: currentUser.growth_skills.map((s) => s.skill_id),
            });
            setSsoNameLocked(Boolean(session?.user?.name));
            setSsoEmailLocked(Boolean(session?.user?.email || currentUser.email));
            setHydratedFromProfile(true);
            return;
        }

        if (status === 'authenticated' && session?.user && !hydratedFromProfile) {
            const ssoName = session.user.name || '';
            const ssoEmail = session.user.email || '';
            if (ssoName || ssoEmail) {
                setFormData(prev => ({
                    ...prev,
                    name: ssoName || prev.name,
                    email: ssoEmail || prev.email,
                }));
                setSsoNameLocked(Boolean(ssoName));
                setSsoEmailLocked(Boolean(ssoEmail));
            }
        }
    }, [status, session, currentUser, hydratedFromProfile]);

    const loadSkills = useCallback(async () => {
        setIsLoadingSkills(true);
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const data = await skillsApi.getAll();
                setSkills(data);
                setError(null);
                setIsLoadingSkills(false);
                return;
            } catch (err) {
                lastError = err;
                if (attempt < 5) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1200));
                }
            }
        }
        console.error('Failed to load skills:', lastError);
        setError('Could not load skills right now. Please try again.');
        setIsLoadingSkills(false);
    }, []);

    useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    const updateField = (field: keyof typeof formData, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const toggleSkill = (type: 'currentSkills' | 'growthSkills', skillId: string) => {
        setFormData(prev => {
            const current = prev[type];
            const updated = current.includes(skillId)
                ? current.filter(id => id !== skillId)
                : [...current, skillId];
            return { ...prev, [type]: updated };
        });
    };

    const canProceed = () => {
        switch (step) {
            case 1: {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return formData.name.trim() !== '' &&
                    formData.email.trim() !== '' &&
                    emailRegex.test(formData.email.trim());
            }
            case 2:
                return formData.unit !== '';
            case 3:
                return formData.currentSkills.length > 0;
            case 4:
                return formData.growthSkills.length > 0;
            default:
                return false;
        }
    };

    const handleNext = async () => {
        if (step < 4) {
            setStep((step + 1) as Step);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const user = await usersApi.create(
                {
                    entra_oid: session?.user?.id,
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    unit: formData.unit,
                    seniority: formData.seniority || undefined,
                    availability: formData.availability.trim() || undefined,
                    current_skills: formData.currentSkills,
                    growth_skills: formData.growthSkills,
                },
                authToken
            );

            localStorage.setItem('freshswipe_user_id', user.id);
            localStorage.setItem('freshswipe_user_name', user.name);
            if (user.email) {
                localStorage.setItem('freshswipe_user_email', user.email);
            }

            await refreshUser();
            router.push('/swipe');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save your onboarding profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep((step - 1) as Step);
        }
    };

    const skillsByCategory = skills.reduce((acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
    }, {} as Record<string, Skill[]>);

    return (
        <div className="page">
            <Navbar minimal />

            <main className="page-content">
                <div className="container container-md">
                    {/* Progress Steps */}
                    <div className={styles.progressBar} role="list" aria-label="Onboarding steps">
                        {[1, 2, 3, 4].map((s) => (
                            <div
                                key={s}
                                role="listitem"
                                aria-current={s === step ? 'step' : undefined}
                                className={`${styles.progressStep} ${s <= step ? styles.active : ''} ${s < step ? styles.completed : ''}`}
                            >
                                <div className={styles.stepNumber}>{s < step ? '✓' : s}</div>
                                <span className={styles.stepLabel}>
                                    {s === 1 && 'Profile'}
                                    {s === 2 && 'Unit'}
                                    {s === 3 && 'Skills'}
                                    {s === 4 && 'Growth'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Step Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                            className={styles.stepContent}
                        >
                            {step === 1 && (
                                <div className="card">
                                    <h2>Welcome to FreshSwipe</h2>
                                    <p className="mb-xl">
                                        {ssoNameLocked || ssoEmailLocked
                                            ? "We've got your details from Microsoft. Just confirm and continue!"
                                            : "Let's start by getting to know you."}
                                    </p>

                                    <div className="form-group">
                                        <label htmlFor="onboarding-name" className="form-label">
                                            Your Name
                                            {ssoNameLocked && (
                                                <span className={styles.ssoBadge}>✓ From Microsoft</span>
                                            )}
                                        </label>
                                        <input
                                            id="onboarding-name"
                                            type="text"
                                            className={`form-input ${ssoNameLocked ? styles.lockedInput : ''}`}
                                            placeholder="Enter your full name"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            readOnly={ssoNameLocked}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="onboarding-email" className="form-label">
                                            Email Address
                                            {ssoEmailLocked && (
                                                <span className={styles.ssoBadge}>✓ From Microsoft</span>
                                            )}
                                        </label>
                                        <input
                                            id="onboarding-email"
                                            type="email"
                                            className={`form-input ${ssoEmailLocked ? styles.lockedInput : ''}`}
                                            placeholder="your.email@freshminds.nl"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            readOnly={ssoEmailLocked}
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="card">
                                    <h2>What&apos;s your unit?</h2>
                                    <p className="mb-xl">Select the team or department you work in.</p>

                                    <div className={styles.unitGrid}>
                                        {UNITS.map((unit) => (
                                            <button
                                                type="button"
                                                key={unit.value}
                                                className={`${styles.unitCard} ${formData.unit === unit.value ? styles.selected : ''}`}
                                                onClick={() => updateField('unit', unit.value)}
                                                aria-pressed={formData.unit === unit.value}
                                            >
                                                <span className={styles.unitIcon} aria-hidden="true">{unit.icon}</span>
                                                <span className={styles.unitLabel}>{unit.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className={styles.optionalRow}>
                                        <div className="form-group">
                                            <label htmlFor="onboarding-seniority" className="form-label">
                                                Seniority (optional)
                                            </label>
                                            <select
                                                id="onboarding-seniority"
                                                className="form-input form-select"
                                                value={formData.seniority}
                                                onChange={(e) => updateField('seniority', e.target.value)}
                                            >
                                                <option value="">Select level</option>
                                                {SENIORITY_LEVELS.map((level) => (
                                                    <option key={level.value} value={level.value}>
                                                        {level.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="onboarding-availability" className="form-label">
                                                Coffee Availability (optional)
                                            </label>
                                            <input
                                                id="onboarding-availability"
                                                type="text"
                                                className="form-input"
                                                placeholder="e.g. 1h/week, ad-hoc, monthly"
                                                value={formData.availability}
                                                onChange={(e) => updateField('availability', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="card">
                                    <h2>What are your current skills?</h2>
                                    <p className="mb-xl">
                                        Select skills you already have experience with ({formData.currentSkills.length} selected).
                                    </p>

                                    {isLoadingSkills && <p>Loading skills...</p>}
                                    {!isLoadingSkills && skills.length === 0 && (
                                        <div>
                                            <p>No skills available yet.</p>
                                            <button type="button" className="btn btn-secondary" onClick={loadSkills}>
                                                Retry Loading Skills
                                            </button>
                                        </div>
                                    )}
                                    {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                                        <div key={category} className={styles.skillCategory}>
                                            <h4 className={styles.categoryTitle}>{category}</h4>
                                            <div className="chip-group">
                                                {categorySkills.map((skill) => {
                                                    const selected = formData.currentSkills.includes(skill.id);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={skill.id}
                                                            className={`chip ${selected ? 'selected' : ''}`}
                                                            onClick={() => toggleSkill('currentSkills', skill.id)}
                                                            aria-pressed={selected}
                                                        >
                                                            <span className="icon" aria-hidden="true">{skill.icon}</span>
                                                            {skill.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {step === 4 && (
                                <div className="card">
                                    <h2>Where do you want to grow?</h2>
                                    <p className="mb-xl">
                                        Select skills you&apos;d like to develop or learn more about ({formData.growthSkills.length} selected).
                                    </p>

                                    {isLoadingSkills && <p>Loading skills...</p>}
                                    {!isLoadingSkills && skills.length === 0 && (
                                        <div>
                                            <p>No skills available yet.</p>
                                            <button type="button" className="btn btn-secondary" onClick={loadSkills}>
                                                Retry Loading Skills
                                            </button>
                                        </div>
                                    )}
                                    {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                                        <div key={category} className={styles.skillCategory}>
                                            <h4 className={styles.categoryTitle}>{category}</h4>
                                            <div className="chip-group">
                                                {categorySkills.map((skill) => {
                                                    const selected = formData.growthSkills.includes(skill.id);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={skill.id}
                                                            className={`chip ${selected ? 'selected' : ''}`}
                                                            onClick={() => toggleSkill('growthSkills', skill.id)}
                                                            aria-pressed={selected}
                                                        >
                                                            <span className="icon" aria-hidden="true">{skill.icon}</span>
                                                            {skill.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {error && (
                        <motion.div
                            role="alert"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={styles.error}
                        >
                            {error}
                        </motion.div>
                    )}

                    <div className={styles.nav}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleBack}
                            disabled={step === 1}
                        >
                            ← Back
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleNext}
                            disabled={!canProceed() || isLoading}
                        >
                            {isLoading ? 'Saving...' : step === 4 ? 'Start Swiping →' : 'Continue →'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
