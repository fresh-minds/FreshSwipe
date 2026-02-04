/**
 * Shared constants for FreshSwipe application.
 * These are used across multiple frontend pages to ensure consistency.
 */

export const ADMIN_EMAIL = 'karel.goense@freshminds.nl';

export const UNITS = [
    { value: 'Software', label: 'Software Engineering', icon: '💻' },
    { value: 'Data', label: 'Data & Analytics', icon: '📊' },
    { value: 'Cloud', label: 'Cloud & Infrastructure', icon: '☁️' },
    { value: 'Security', label: 'Security', icon: '🔒' },
    { value: 'Staff', label: 'Staff', icon: '🏢' },
] as const;

export type UnitValue = typeof UNITS[number]['value'];

export const SENIORITY_LEVELS = [
    { value: 'Junior', label: 'Junior' },
    { value: 'Medior', label: 'Medior' },
    { value: 'Senior', label: 'Senior' },
    { value: 'Principal', label: 'Principal' },
] as const;

export type SeniorityValue = typeof SENIORITY_LEVELS[number]['value'];
