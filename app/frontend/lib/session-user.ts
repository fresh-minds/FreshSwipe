import { usersApi, User } from '@/lib/api';

type SessionLike = {
    user?: {
        email?: string | null;
    } | null;
} | null;

/**
 * Resolve and persist the backend user for the currently authenticated session.
 * This prevents stale localStorage identities from previous logins.
 */
export async function syncSessionUser(
    session: SessionLike,
    accessToken?: string
): Promise<User | null> {
    const email = session?.user?.email;
    if (!email) return null;

    const user = await usersApi.getByEmail(email, accessToken);
    if (typeof window !== 'undefined' && user?.id) {
        localStorage.setItem('freshswipe_user_id', user.id);
        localStorage.setItem('freshswipe_user_name', user.name);
        localStorage.setItem('freshswipe_user_email', user.email);
    }
    return user;
}

