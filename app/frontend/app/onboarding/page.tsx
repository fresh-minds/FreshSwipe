'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { skillsApi, usersApi, Skill } from '@/lib/api';
import { UNITS } from '@/lib/constants';
import styles from './onboarding.module.css';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [step, setStep] = useState<Step>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [ssoNameLocked, setSsoNameLocked] = useState(false);
    const [ssoEmailLocked, setSsoEmailLocked] = useState(false);
    const [isLoadingSkills, setIsLoadingSkills] = useState(true);

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        unit: '',
        currentSkills: [] as string[],
        growthSkills: [] as string[],
    });

    // Auto-populate from SSO session
    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
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
    }, [status, session]);

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

    const updateField = (field: string, value: unknown) => {
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
            case 1:
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return formData.name.trim() !== '' &&
                    formData.email.trim() !== '' &&
                    emailRegex.test(formData.email.trim());
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
        } else {
            // Submit
            setIsLoading(true);
            setError(null);

            try {
                const user = await usersApi.create({
                    entra_oid: (session?.user as any)?.id,
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    unit: formData.unit,
                    current_skills: formData.currentSkills,
                    growth_skills: formData.growthSkills,
                });

                // Store user ID for later use
                localStorage.setItem('freshswipe_user_id', user.id);
                localStorage.setItem('freshswipe_user_name', user.name);
                localStorage.setItem('freshswipe_user_email', user.email);

                // Redirect to swipe page
                router.push('/swipe');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create account');
            } finally {
                setIsLoading(false);
            }
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
            <header className="page-header">
                <div className="container">
                    <nav className="nav">
                        <Link href="/" className="nav-brand">
                            <Image src="/logo.png" alt="FreshSwipe Logo" width={32} height={32} className="mr-2" />
                            <span>FreshSwipe</span>
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="page-content">
                <div className="container container-md">
                    {/* Progress Steps */}
                    <div className={styles.progressBar}>
                        {[1, 2, 3, 4].map((s) => (
                            <div
                                key={s}
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
                            transition={{ duration: 0.3 }}
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
                                        <label className="form-label">
                                            Your Name
                                            {ssoNameLocked && <span style={{ color: '#0078d4', marginLeft: '8px', fontSize: '0.8em' }}>✓ From Microsoft</span>}
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Enter your full name"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            readOnly={ssoNameLocked}
                                            style={ssoNameLocked ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {}}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            Email Address
                                            {ssoEmailLocked && <span style={{ color: '#0078d4', marginLeft: '8px', fontSize: '0.8em' }}>✓ From Microsoft</span>}
                                        </label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="your.email@company.com"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            readOnly={ssoEmailLocked}
                                            style={ssoEmailLocked ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {}}
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
                                                key={unit.value}
                                                className={`${styles.unitCard} ${formData.unit === unit.value ? styles.selected : ''}`}
                                                onClick={() => updateField('unit', unit.value)}
                                            >
                                                <span className={styles.unitIcon}>{unit.icon}</span>
                                                <span className={styles.unitLabel}>{unit.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="card">
                                    <h2>What are your current skills?</h2>
                                    <p className="mb-xl">Select skills you already have experience with.</p>

                                    {isLoadingSkills && <p>Loading skills...</p>}
                                    {!isLoadingSkills && skills.length === 0 && (
                                        <div>
                                            <p>No skills available yet.</p>
                                            <button className="btn btn-secondary" onClick={loadSkills}>Retry Loading Skills</button>
                                        </div>
                                    )}
                                    {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                                        <div key={category} className={styles.skillCategory}>
                                            <h4 className={styles.categoryTitle}>{category}</h4>
                                            <div className="chip-group">
                                                {categorySkills.map((skill) => (
                                                    <button
                                                        key={skill.id}
                                                        className={`chip ${formData.currentSkills.includes(skill.id) ? 'selected' : ''}`}
                                                        onClick={() => toggleSkill('currentSkills', skill.id)}
                                                    >
                                                        <span className="icon">{skill.icon}</span>
                                                        {skill.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {step === 4 && (
                                <div className="card">
                                    <h2>Where do you want to grow?</h2>
                                    <p className="mb-xl">Select skills you&apos;d like to develop or learn more about.</p>

                                    {isLoadingSkills && <p>Loading skills...</p>}
                                    {!isLoadingSkills && skills.length === 0 && (
                                        <div>
                                            <p>No skills available yet.</p>
                                            <button className="btn btn-secondary" onClick={loadSkills}>Retry Loading Skills</button>
                                        </div>
                                    )}
                                    {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                                        <div key={category} className={styles.skillCategory}>
                                            <h4 className={styles.categoryTitle}>{category}</h4>
                                            <div className="chip-group">
                                                {categorySkills.map((skill) => (
                                                    <button
                                                        key={skill.id}
                                                        className={`chip ${formData.growthSkills.includes(skill.id) ? 'selected' : ''}`}
                                                        onClick={() => toggleSkill('growthSkills', skill.id)}
                                                    >
                                                        <span className="icon">{skill.icon}</span>
                                                        {skill.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Error message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={styles.error}
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Navigation buttons */}
                    <div className={styles.nav}>
                        <button
                            className="btn btn-secondary"
                            onClick={handleBack}
                            disabled={step === 1}
                        >
                            ← Back
                        </button>
                        <button
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
