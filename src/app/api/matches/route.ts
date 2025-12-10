import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || 'eu';
    const name = searchParams.get('name');
    const tag = searchParams.get('tag');
    const start = searchParams.get('start') || '0';
    const size = searchParams.get('size') || '10';

    if (!name || !tag) {
        return NextResponse.json({ error: 'Missing name or tag' }, { status: 400 });
    }

    const apiKey = process.env.HENRIK_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `https://api.henrikdev.xyz/valorant/v4/matches/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=competitive&size=${size}&start=${start}&api_key=${apiKey}`,
            { cache: 'no-store' }
        );

        const data = await response.json();

        if (data.status !== 200) {
            return NextResponse.json({
                error: data.errors?.[0]?.message || 'API Error',
                matches: []
            }, { status: 200 });
        }

        return NextResponse.json({
            matches: data.data || [],
            count: data.data?.length || 0
        });

    } catch (error) {
        console.error('Error fetching matches:', error);
        return NextResponse.json({ error: 'Failed to fetch matches', matches: [] }, { status: 500 });
    }
}
