import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region') || 'eu';

    if (!matchId) {
        return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
    }

    const apiKey = process.env.HENRIK_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `https://api.henrikdev.xyz/valorant/v4/match/${region}/${matchId}?api_key=${apiKey}`,
            { cache: 'no-store' }
        );

        const data = await response.json();

        if (data.status !== 200) {
            return NextResponse.json({
                error: data.errors?.[0]?.message || 'Match not found',
                match: null
            }, { status: 200 });
        }

        // Handle both array and object response
        const match = Array.isArray(data.data) ? data.data[0] : data.data;

        return NextResponse.json({
            match,
            rounds: match?.rounds || [],
            players: match?.players || []
        });

    } catch (error) {
        console.error('Error fetching match details:', error);
        return NextResponse.json({ error: 'Failed to fetch match', match: null }, { status: 500 });
    }
}
