'use client';

import { SessionProvider, useSession, signIn } from "next-auth/react";
import { useEffect } from "react";

function AuthErrorListener({ children }: { children: React.ReactNode }) {
    // Determine the error by casting session to any, as standard Session type doesn't have 'error'
    const { data: session } = useSession();

    useEffect(() => {
        if ((session as any)?.error === "RefreshAccessTokenError") {
            // Automatically sign in again if the token refresh failed
            signIn("azure-ad");
        }
    }, [session]);

    return <>{children}</>;
}

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthErrorListener>
                {children}
            </AuthErrorListener>
        </SessionProvider>
    );
}
