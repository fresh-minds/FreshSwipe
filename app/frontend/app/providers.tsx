'use client';

import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import { useEffect } from "react";
import { CurrentUserProvider } from "@/lib/user-context";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";

function AuthErrorListener({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            signIn("azure-ad");
        } else if (session?.error === "CredentialsExpiredError") {
            signOut({ callbackUrl: "/login?error=SessionExpired" });
        }
    }, [session?.error]);

    return <>{children}</>;
}

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthErrorListener>
                <CurrentUserProvider>
                    {children}
                    <FloatingChatWidget />
                </CurrentUserProvider>
            </AuthErrorListener>
        </SessionProvider>
    );
}
