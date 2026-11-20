import crypto from "crypto";
import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";

function timingSafeEquals(a: string, b: string): boolean {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

function base64UrlEncode(input: Buffer | string): string {
    return Buffer.from(input)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${header}.${body}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(signingInput)
        .digest();
    return `${signingInput}.${base64UrlEncode(signature)}`;
}

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
            accessToken: refreshedTokens.id_token || refreshedTokens.access_token,
            idToken: refreshedTokens.id_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            error: undefined,
        };
    } catch (error) {
        console.error("RefreshAccessTokenError", error);

        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

const CREDENTIALS_TTL_SECONDS = 8 * 60 * 60; // 8 hours

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
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const adminEmail = process.env.ADMIN_EMAIL;
                const adminPassword = process.env.ADMIN_PASSWORD;

                if (!adminEmail || !adminPassword) {
                    console.warn("Admin login disabled: ADMIN_EMAIL or ADMIN_PASSWORD not set");
                    return null;
                }

                if (
                    credentials?.email &&
                    credentials?.password &&
                    timingSafeEquals(credentials.email.trim().toLowerCase(), adminEmail.trim().toLowerCase()) &&
                    timingSafeEquals(credentials.password, adminPassword)
                ) {
                    return {
                        id: `local-${adminEmail.trim().toLowerCase()}`,
                        name: "Admin User",
                        email: adminEmail,
                        image: null,
                    };
                }
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile, user }) {
            try {
                // Initial sign in via CredentialsProvider (Admin)
                if (account?.provider === "credentials" && user) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    const expSec = nowSec + CREDENTIALS_TTL_SECONDS;
                    const secret = process.env.NEXTAUTH_SECRET;
                    const signedToken = secret
                        ? signHs256Jwt(
                            {
                                sub: user.id,
                                email: user.email,
                                name: user.name,
                                iat: nowSec,
                                exp: expSec,
                            },
                            secret
                        )
                        : undefined;

                    return {
                        ...token,
                        provider: "credentials",
                        accessToken: signedToken,
                        idToken: signedToken,
                        accessTokenExpires: expSec * 1000,
                        oid: user.id,
                        error: undefined,
                    };
                }

                // Initial sign in via Azure AD / Entra ID
                if (account && profile) {
                    return {
                        ...token,
                        provider: account.provider,
                        accessToken: account.id_token || account.access_token,
                        idToken: account.id_token,
                        refreshToken: account.refresh_token,
                        accessTokenExpires: (account.expires_at || 0) * 1000,
                        oid: (profile as { oid?: string }).oid,
                        error: undefined,
                    };
                }

                // Credentials sessions never use Entra ID refresh tokens
                if (token.provider === "credentials") {
                    if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
                        return token;
                    }
                    return { ...token, error: "CredentialsExpiredError" };
                }

                // Return previous Entra token if it has not expired yet
                if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 5 * 60 * 1000) {
                    return token;
                }

                return await refreshAccessToken(token);
            } catch (error) {
                console.error("Error in JWT callback:", error);
                return { ...token, error: "JWTCallbackError" };
            }
        },
        async session({ session, token }) {
            try {
                session.accessToken = token.accessToken;
                session.idToken = token.idToken;
                session.error = token.error;

                session.user = session.user || {};

                if (token.oid) {
                    session.user.id = token.oid;
                } else if (token.sub) {
                    session.user.id = token.sub;
                }

                if (!session.user.name && token.name) session.user.name = token.name;
                if (!session.user.email && token.email) session.user.email = token.email;

                return session;
            } catch (error) {
                console.error("Error in Session callback:", error);
                session.error = "SessionCallbackError";
                return session;
            }
        },
    },
    pages: {
        signIn: "/login",
    },
};
