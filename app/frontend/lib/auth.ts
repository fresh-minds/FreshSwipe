import { NextAuthOptions } from "next-auth";
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

        const url = `https://login.microsoftonline.com/${process.env.AZURE_ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common"}/oauth2/v2.0/token`;

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            body: new URLSearchParams({
                client_id: process.env.AZURE_ENTRA_AD_CLIENT_ID || "",
                client_secret: process.env.AZURE_ENTRA_AD_CLIENT_SECRET || "",
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

export const authOptions: NextAuthOptions = {
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_ENTRA_AD_CLIENT_ID || "",
            clientSecret: process.env.AZURE_ENTRA_AD_CLIENT_SECRET || "",
            tenantId: process.env.AZURE_ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common",
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
            try {
                // Initial sign in
                if (account && profile) {
                    console.log("Initial sign-in: processing token");
                    return {
                        ...token, // Keep default properties (name, email, picture)
                        accessToken: account.id_token || account.access_token,
                        idToken: account.id_token,
                        refreshToken: account.refresh_token,
                        accessTokenExpires: (account.expires_at || 0) * 1000,
                        oid: (profile as any).oid,
                    };
                }

                // Return previous token if the access token has not expired yet
                if (Date.now() < ((token.accessTokenExpires as number) - 5 * 60 * 1000)) {
                    return token;
                }

                // Access token has expired, try to update it
                console.log("Token expired, refreshing...");
                return await refreshAccessToken(token);
            } catch (error) {
                console.error("Error in JWT callback:", error);
                return { ...token, error: "JWTCallbackError" };
            }
        },
        async session({ session, token }: any) {
            try {
                session.accessToken = token.accessToken;
                session.idToken = token.idToken;
                session.error = token.error;

                session.user = session.user || {};

                // Include user ID from Azure AD OID or Subject (for Credentials)
                if (token.oid) {
                    session.user.id = token.oid;
                } else if (token.sub) {
                    session.user.id = token.sub;
                }

                // Ensure name/email are persisted if missing
                if (!session.user.name && token.name) session.user.name = token.name;
                if (!session.user.email && token.email) session.user.email = token.email;

                return session;
            } catch (error) {
                console.error("Error in Session callback:", error);
                // Return a safe fallback session to prevent circular redirects
                session.error = "SessionCallbackError";
                return session;
            }
        },
    },
    pages: {
        signIn: '/login',
    },
};
