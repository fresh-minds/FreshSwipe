import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
    providers: [
        AzureADProvider({
            clientId: process.env.ENTRA_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "",
            clientSecret: process.env.ENTRA_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || "",
            tenantId: process.env.ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common",
            authorization: {
                params: {
                    scope: "openid profile email User.Read",
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
            if (account) {
                token.idToken = account.id_token;
                // Prefer ID token for backend auth (audience = app client_id)
                token.accessToken = account.id_token || account.access_token;
            }
            if (profile) {
                // Azure AD includes oid (object ID) in profile
                token.oid = (profile as any).oid;
            }
            return token;
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
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
