'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usersApi, UserWithSkills } from '@/lib/api';

interface CurrentUserContextValue {
    currentUser: UserWithSkills | null;
    authToken: string | undefined;
    sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
    isAdmin: boolean;
    hasSkills: boolean;
    loading: boolean;
    error: string | null;
    refreshUser: () => Promise<UserWithSkills | null>;
}

const CurrentUserContext = createContext<CurrentUserContextValue>({
    currentUser: null,
    authToken: undefined,
    sessionStatus: 'loading',
    isAdmin: false,
    hasSkills: false,
    loading: true,
    error: null,
    refreshUser: async () => null,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const authToken = session?.idToken || session?.accessToken;
    const [currentUser, setCurrentUser] = useState<UserWithSkills | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshUser = useCallback(async (): Promise<UserWithSkills | null> => {
        if (status !== 'authenticated' || !authToken) {
            return null;
        }
        setLoading(true);
        setError(null);
        try {
            const me = await usersApi.getMe(authToken);
            setCurrentUser(me);
            if (typeof window !== 'undefined') {
                localStorage.setItem('freshswipe_user_id', me.id);
                localStorage.setItem('freshswipe_user_name', me.name);
                if (me.email) {
                    localStorage.setItem('freshswipe_user_email', me.email);
                }
            }
            return me;
        } catch (err) {
            console.error('Failed to load current user profile:', err);
            setError(err instanceof Error ? err.message : 'Failed to load user profile');
            return null;
        } finally {
            setLoading(false);
        }
    }, [status, authToken]);

    useEffect(() => {
        if (status === 'loading') {
            setLoading(true);
            return;
        }
        if (status === 'unauthenticated') {
            setCurrentUser(null);
            setLoading(false);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('freshswipe_user_id');
                localStorage.removeItem('freshswipe_user_name');
                localStorage.removeItem('freshswipe_user_email');
            }
            return;
        }
        if (status === 'authenticated' && authToken) {
            refreshUser();
        } else {
            setLoading(false);
        }
    }, [status, authToken, refreshUser]);

    const hasSkills = Boolean(
        currentUser &&
        (currentUser.current_skills.length > 0 || currentUser.growth_skills.length > 0)
    );

    return (
        <CurrentUserContext.Provider
            value={{
                currentUser,
                authToken,
                sessionStatus: status,
                isAdmin: Boolean(currentUser?.is_admin),
                hasSkills,
                loading: status === 'loading' || loading,
                error,
                refreshUser,
            }}
        >
            {children}
        </CurrentUserContext.Provider>
    );
}

export function useCurrentUser() {
    return useContext(CurrentUserContext);
}
