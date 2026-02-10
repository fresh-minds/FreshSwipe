import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();

        // Proxy to backend
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://app:80"; // Use internal docker name if server-side

        // Determine URL: if running in browser/client side it might be different, but this is a server route.
        // In docker-compose, 'app' is the service name.
        // However, Next.js runs in 'frontend' container? No, it's dev mode in host or docker?
        // Let's check docker-compose.yml again to be sure about networking.
        // Assuming 'app' service is the backend on port 80 based on docker-compose in Step 37 ("ports: - 8081:80")

        // Actually, looking at docker-compose, 'app' service exposes 8081:80.
        // Inside the docker network, it's likely accessible as 'app:80' or just 'app'.
        // But for local dev running 'npm run dev' on host, it needs to hit localhost:8081.

        // Use localhost:80 (Nginx) inside the container, or 8081 from host if running locally outside docker (but this is server-side)
        // Since we are likely running in the same container ("unified"), localhost:80 works.
        const apiUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:80";

        const response = await fetch(`${apiUrl}/api/v1/chat/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Pass auth token if backend requires it. 
                // Since using next-auth with Entra ID, we might need the access token.
                // Or if using cookie-based auth proxy?
                // The requirements say "backend requires valid user session".
                // If using Entra ID, backend validates the token.
                // We'll pass the session access token if available.
                "Authorization": `Bearer ${session.accessToken || session.idToken}`
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(errorText, {
                status: response.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Chat proxy error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
