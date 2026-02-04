import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * Build headers for backend request, forwarding Authorization if present
 */
function buildHeaders(request: NextRequest): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    return headers;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    const pathString = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/v1/${pathString}${searchParams ? `?${searchParams}` : ''}`;

    try {
        const response = await fetch(url, {
            headers: buildHeaders(request),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('API proxy error:', error);
        return NextResponse.json(
            { detail: 'Failed to connect to backend' },
            { status: 502 }
        );
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    const url = `${BACKEND_URL}/api/v1/${path.join('/')}`;

    let body;
    try {
        const text = await request.text();
        body = text ? JSON.parse(text) : undefined;
    } catch (e) {
        body = undefined;
    }

    try {
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: buildHeaders(request),
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('API proxy error:', error);
        return NextResponse.json(
            { detail: 'Failed to connect to backend' },
            { status: 502 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    const url = `${BACKEND_URL}/api/v1/${path.join('/')}`;

    let body;
    try {
        const text = await request.text();
        body = text ? JSON.parse(text) : undefined;
    } catch (e) {
        body = undefined;
    }

    try {
        const fetchOptions: RequestInit = {
            method: 'PATCH',
            headers: buildHeaders(request),
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('API proxy error:', error);
        return NextResponse.json(
            { detail: 'Failed to connect to backend' },
            { status: 502 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    const url = `${BACKEND_URL}/api/v1/${path.join('/')}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(request),
        });

        // DELETE might return empty body
        if (response.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('API proxy error:', error);
        return NextResponse.json(
            { detail: 'Failed to connect to backend' },
            { status: 502 }
        );
    }
}
