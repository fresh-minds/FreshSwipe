import { withAuth } from "next-auth/middleware";

export default withAuth({
    callbacks: {
        authorized: ({ token }) => !!token,
    },
});

export const config = {
    matcher: [
        "/",
        "/swipe/:path*",
        "/matches/:path*",
        "/profile/:path*",
        "/insights/:path*",
        "/feedback/:path*",
        "/team-trends/:path*",
        "/onboarding/:path*",
    ],
};
