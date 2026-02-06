/**
 * API client for FreshSwipe backend
 */

const API_BASE = '/api/v1';

export interface Skill {
    id: string;
    name: string;
    category: string;
    description: string | null;
    icon: string | null;
    display_order: number;
    is_active: boolean;
}

export interface User {
    id: string;
    name: string;
    email: string;
    unit: string;
    seniority?: string;
    availability?: string;
    created_at: string;
    updated_at: string;
}

export interface UserSkill {
    id: string;
    skill_id: string;
    skill_type: 'CURRENT' | 'GROWTH';
    skill_name: string;
}

export interface UserWithSkills extends User {
    current_skills: UserSkill[];
    growth_skills: UserSkill[];
}

export interface Swipe {
    id: string;
    user_id: string;
    target_user_id: string;
    direction: 'left' | 'right' | 'super';
    created_at: string;
    target_user_name?: string;
}

export interface UserOnboarding {
    entra_oid?: string;
    name: string;
    email: string;
    unit: string;
    current_skills: string[];
    growth_skills: string[];
}

export interface UserSummary {
    total_swipes: number;
    swipe_breakdown: Record<string, number>;
    top_interests: Array<{
        name: string;
        category: string;
        is_super: boolean;
    }>;
    category_distribution: Record<string, number>;
    super_likes: number;
}

export interface SkillStats {
    id: string;
    name: string;
    category: string;
    total_swipes: number;
    right_swipes: number;
    super_swipes: number;
    left_swipes: number;
    interest_rate: number;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
        console.error(`API Error on ${endpoint}:`, res.status, error);
        throw new Error(error.detail || `API error: ${res.status} on ${endpoint}`);
    }

    return res.json();
}

function authHeaders(accessToken?: string): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// Skills API
export const skillsApi = {
    getAll: () => fetchAPI<Skill[]>('/skills/'),
    getForUser: (userId: string) => fetchAPI<Skill[]>(`/skills/for-user/${userId}`),
    getCategories: () => fetchAPI<string[]>('/skills/categories'),
};

// Users API
export const usersApi = {
    create: (data: UserOnboarding) =>
        fetchAPI<User>('/users/onboard', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getByEmail: (email: string, accessToken?: string) =>
        fetchAPI<User>(`/users/by-email/${encodeURIComponent(email)}`, {
            headers: authHeaders(accessToken),
        }),
    getById: (id: string, accessToken?: string) =>
        fetchAPI<UserWithSkills>(`/users/${id}`, {
            headers: authHeaders(accessToken),
        }),
    list: (accessToken?: string) => fetchAPI<User[]>('/users/', {
        headers: authHeaders(accessToken),
    }),
    getCandidates: (accessToken?: string) => fetchAPI<User[]>('/users/candidates', {
        headers: authHeaders(accessToken),
    }),
};

// Swipes API
export const swipesApi = {
    create: (data: { user_id: string; target_user_id: string; direction: string }, accessToken?: string) =>
        fetchAPI<Swipe>('/swipes/', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: authHeaders(accessToken),
        }),
    getUserSwipes: (userId: string, accessToken?: string) =>
        fetchAPI<Swipe[]>(`/swipes/user/${userId}`, {
            headers: authHeaders(accessToken),
        }),
    getUserInterests: (userId: string, accessToken?: string) =>
        fetchAPI<Swipe[]>(`/swipes/user/${userId}/interests`, {
            headers: authHeaders(accessToken),
        }),
};

// Analytics API
export const analyticsApi = {
    getUserSummary: (userId: string, accessToken?: string) =>
        fetchAPI<UserSummary>(`/analytics/user/${userId}/summary`, {
            headers: authHeaders(accessToken),
        }),
    getOrgSkillStats: (unit?: string, accessToken?: string) => {
        const query = unit ? `?unit=${unit}` : '';
        return fetchAPI<SkillStats[]>(`/analytics/organization/skills${query}`, {
            headers: authHeaders(accessToken),
        });
    },
    getUnitDistribution: (accessToken?: string) =>
        fetchAPI<Record<string, number>>('/analytics/organization/units', {
            headers: authHeaders(accessToken),
        }),
    getTrendingSkills: (limit = 10, accessToken?: string) =>
        fetchAPI<Array<{ name: string; category: string; interest_count: number }>>(
            `/analytics/organization/trends?limit=${limit}`,
            { headers: authHeaders(accessToken) }
        ),
    getCategoryBreakdown: (accessToken?: string) =>
        fetchAPI<Array<{ category: string; total_swipes: number; interested: number; super_interested: number }>>(
            '/analytics/organization/category-breakdown',
            { headers: authHeaders(accessToken) }
        ),
};

// Coffee Dates types
export interface CoffeeDateSuggestion {
    user_id: string;
    user_name: string;
    user_email: string;
    user_unit: string;
    user_seniority: string | null;
    user_availability: string | null;
    score: number;
    reasons: string[];
    match_type: 'peer' | 'mentor' | 'mentee';
}

export interface CoffeeDate {
    id: string;
    requester_id: string;
    requester_name: string;
    requester_email: string;
    recipient_id: string;
    recipient_name: string;
    recipient_email: string;
    status: 'suggested' | 'requested' | 'accepted' | 'declined' | 'completed';
    proposed_time: string | null;
    location: string | null;
    message: string | null;
    match_score: number;
    match_reasons: string[];
    match_type: 'peer' | 'mentor' | 'mentee' | null;
    created_at: string;
    updated_at: string;
}

export interface CoffeeDateRequest {
    recipient_id: string;
    proposed_time?: string;
    location?: string;
    message?: string;
}

export interface FeedbackCreate {
    message: string;
    rating?: number;
    category?: string;
    page?: string;
}

export interface Feedback {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    message: string;
    rating: number | null;
    category: string | null;
    page: string | null;
    created_at: string;
}

// Coffee Dates API
export const coffeeDatesApi = {
    getSuggestions: (limit = 10, matchType?: string, accessToken?: string) => {
        const params = new URLSearchParams({ limit: limit.toString() });
        if (matchType) params.append('match_type', matchType);
        return fetchAPI<CoffeeDateSuggestion[]>(`/coffee-dates/suggestions?${params}`, {
            headers: authHeaders(accessToken),
        });
    },
    createRequest: (data: CoffeeDateRequest, accessToken?: string) =>
        fetchAPI<CoffeeDate>('/coffee-dates/request', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: authHeaders(accessToken),
        }),
    list: (status?: string, accessToken?: string) => {
        const params = status ? `?status_filter=${status}` : '';
        return fetchAPI<CoffeeDate[]>(`/coffee-dates/${params}`, {
            headers: authHeaders(accessToken),
        });
    },
    respond: (id: string, status: 'accepted' | 'declined', accessToken?: string) =>
        fetchAPI<CoffeeDate>(`/coffee-dates/${id}/respond`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
            headers: authHeaders(accessToken),
        }),
    complete: (id: string, accessToken?: string) =>
        fetchAPI<CoffeeDate>(`/coffee-dates/${id}/complete`, {
            method: 'PATCH',
            headers: authHeaders(accessToken),
        }),
    autoMatch: (accessToken?: string) =>
        fetchAPI<CoffeeDate>('/coffee-dates/auto-match', {
            method: 'POST',
            headers: authHeaders(accessToken),
        }),
};

export const feedbackApi = {
    create: (data: FeedbackCreate, accessToken?: string) =>
        fetchAPI<Feedback>('/feedback/', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: authHeaders(accessToken),
        }),
    list: (accessToken?: string) =>
        fetchAPI<Feedback[]>('/feedback/', {
            headers: authHeaders(accessToken),
        }),
};
