import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

import { JWT } from "next-auth/jwt";

async function refreshAccessToken(token: JWT): Promise<JWT> {
    try {
        if (!token.refreshToken) {
            console.error("No refresh token available");
            return {
                ...token,
                error: "RefreshAccessTokenError",
            };
        }

        const url = `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common"}/oauth2/v2.0/token`;

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            body: new URLSearchParams({
                client_id: process.env.ENTRA_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "",
                client_secret: process.env.ENTRA_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || "",
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
                scope: "openid profile email User.Read offline_access",
            }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
            throw refreshedTokens;
        }

        return {
            ...token,
            // Prefer id_token if returned, else access_token
            accessToken: refreshedTokens.id_token || refreshedTokens.access_token,
            idToken: refreshedTokens.id_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            // Fall back to old refresh token if new one not provided
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        };
    } catch (error) {
        console.error("RefreshAccessTokenError", error);

        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

const handler = NextAuth({
    providers: [
        AzureADProvider({
            clientId: process.env.ENTRA_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "",
            clientSecret: process.env.ENTRA_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || "",
            tenantId: process.env.ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common",
            authorization: {
                params: {
                    scope: "openid profile email User.Read offline_access",
                },
            },
        }),
        CredentialsProvider({
            name: "Admin Login",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                // Admin credentials from environment variables
                const adminEmail = process.env.ADMIN_EMAIL;
                const adminPassword = process.env.ADMIN_PASSWORD;

                if (!adminEmail || !adminPassword) {
                    console.warn("Admin login disabled: ADMIN_EMAIL or ADMIN_PASSWORD not set");
                    return null;
                }

                if (credentials?.email === adminEmail && credentials?.password === adminPassword) {
                    return {
                        id: "oid-admin",
                        name: "Admin User",
                        email: adminEmail,
                        image: null,
                    };
                }
                return null;
            }
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // Initial sign in
            if (account && profile) {
                return {
                    accessToken: account.id_token || account.access_token,
                    // Use id_token if available for bearer, or access_token. 
                    // Note: Azure AD v2 usually sends a short-lived access token for the graph, 
                    // but we might be treating id_token as the access token for our backend.
                    // If we need to refresh, we need the actual access_token logic.
                    // Given the previous code used id_token OR access_token:
                    // We'll prioritize capturing the refresh token.

                    idToken: account.id_token,
                    refreshToken: account.refresh_token,
                    accessTokenExpires: (account.expires_at || 0) * 1000,
                    oid: (profile as any).oid,
                };
            }

            // Return previous token if the access token has not expired yet
            // Give a 5 minute buffer
            if (Date.now() < ((token.accessTokenExpires as number) - 5 * 60 * 1000)) {
                return token;
            }

            // Access token has expired, try to update it
            return await refreshAccessToken(token);
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
            session.error = token.error;

            // Include user ID from Azure AD OID or Subject (for Credentials)
            if (token.oid) {
                session.user.id = token.oid;
            } else if (token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
});

export { handler as GET, handler as POST };
