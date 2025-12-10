// API utilities for Henrik Valorant API
const API_BASE = 'https://api.henrikdev.xyz';

export async function fetchValorantAPI(endpoint: string) {
    const apiKey = process.env.HENRIK_API_KEY;

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${API_BASE}${endpoint}${separator}api_key=${apiKey}`;

    const response = await fetch(url, {
        next: { revalidate: 60 } // Cache for 60 seconds
    });

    const data = await response.json();

    if (data.status === 429) {
        throw new Error('Rate limit reached. Please try again in a minute.');
    }

    if (data.status === 404) {
        throw new Error('Player not found. Check the Riot ID format (Name#Tag).');
    }

    if (data.status && data.status !== 200) {
        throw new Error(data.errors?.[0]?.message || `API Error: ${data.status}`);
    }

    return data;
}

// Rank images mapping
export const RANK_IMAGES: Record<string, string> = {
    'iron 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/3624-valorant-iron-1.png',
    'iron 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/7351-valorant-iron-2.png',
    'iron 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/1854-valorant-iron-3.png',
    'bronze 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4159-valorant-bronze-1.png',
    'bronze 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4376-valorant-bronze-2.png',
    'bronze 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4590-valorant-bronze-3.png',
    'silver 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/6335-valorant-silver-1.png',
    'silver 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/8138-valorant-silver-2.png',
    'silver 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/3293-valorant-silver-3.png',
    'gold 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/5533-valorant-gold-1.png',
    'gold 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/2060-valorant-gold-2.png',
    'gold 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/3293-valorant-gold-3.png',
    'platinum 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4590-valorant-platinum-1.png',
    'platinum 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/3255-valorant-platinum-2.png',
    'platinum 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/5816-valorant-platinum-3.png',
    'diamond 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4590-valorant-diamond-1.png',
    'diamond 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/3939-valorant-diamond-2.png',
    'diamond 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/6354-valorant-diamond-3.png',
    'ascendant 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/4590-valorant-ascendant-1.png',
    'ascendant 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/8376-valorant-ascendant-2.png',
    'ascendant 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/2309-valorant-ascendant-3.png',
    'immortal 1': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/1518-valorant-immortal-1.png',
    'immortal 2': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/1518-valorant-immortal-2.png',
    'immortal 3': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/1518-valorant-immortal-3.png',
    'radiant': 'https://storage.googleapis.com/blind-test-red-empire/tracker/rank/9867-valorant-radiant.png',
};

export function getRankImage(rankName: string): string {
    const key = rankName.toLowerCase();
    return RANK_IMAGES[key] || RANK_IMAGES['iron 1'];
}

export function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}j`;
    return `${Math.floor(seconds / 604800)}sem`;
}
