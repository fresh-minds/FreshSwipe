import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:8000';

/**
 * Build headers for backend request, forwarding Authorization if present.
 */
function buildHeaders(request: NextRequest): HeadersInit {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    return headers;
}

async function proxyRequest(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
): Promise<NextResponse> {
    const { path } = await context.params;
    const pathString = path.join('/');
    const trailingSlash = request.nextUrl.pathname.endsWith('/') ? '/' : '';
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/v1/${pathString}${trailingSlash}${searchParams ? `?${searchParams}` : ''}`;

    try {
        const fetchOptions: RequestInit = {
            method,
            headers: buildHeaders(request),
            redirect: 'manual',
        };

        if (method !== 'GET' && method !== 'DELETE') {
            const rawBody = await request.text();
            if (rawBody.length > 0) {
                fetchOptions.body = rawBody;
            }
        }

        let response = await fetch(url, fetchOptions);

        // If FastAPI redirects for canonical trailing slash, re-send with headers intact
        if ((response.status === 307 || response.status === 308) && response.headers.get('location')) {
            const location = response.headers.get('location')!;
            const redirectUrl = location.startsWith('http') ? location : `${BACKEND_URL}${location}`;
            response = await fetch(redirectUrl, fetchOptions);
        }

        if (response.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();

        if (!responseText) {
            return new NextResponse(null, { status: response.status });
        }

        if (contentType.includes('application/json')) {
            try {
                return NextResponse.json(JSON.parse(responseText), { status: response.status });
            } catch {
                // Fall through to plain-text response
            }
        }

        return new NextResponse(responseText, {
            status: response.status,
            headers: { 'Content-Type': contentType || 'text/plain' },
        });
    } catch (error) {
        console.error('API proxy error:', error);
        return NextResponse.json(
            { detail: 'Failed to connect to backend' },
            { status: 502 }
        );
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, context, 'GET');
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, context, 'POST');
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, context, 'PATCH');
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, context, 'PUT');
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, context, 'DELETE');
}
