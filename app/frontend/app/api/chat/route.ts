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

    const token = session.idToken || session.accessToken;
    if (!token) {
        return new Response(JSON.stringify({ error: "Missing session token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        const apiUrl =
            process.env.BACKEND_INTERNAL_URL ||
            process.env.BACKEND_URL ||
            "http://127.0.0.1:8000";

        const response = await fetch(`${apiUrl}/api/v1/chat/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const responseText = await response.text();
        if (!response.ok) {
            return new Response(responseText || JSON.stringify({ error: "Chat request failed" }), {
                status: response.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(responseText, {
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
