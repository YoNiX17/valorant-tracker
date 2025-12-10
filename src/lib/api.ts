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

// Rank images mapping - using official valorant-api.com images
export const RANK_IMAGES: Record<string, string> = {
    'iron 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/3/largeicon.png',
    'iron 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/4/largeicon.png',
    'iron 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/5/largeicon.png',
    'bronze 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/6/largeicon.png',
    'bronze 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/7/largeicon.png',
    'bronze 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/8/largeicon.png',
    'silver 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/9/largeicon.png',
    'silver 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/10/largeicon.png',
    'silver 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/11/largeicon.png',
    'gold 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/12/largeicon.png',
    'gold 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/13/largeicon.png',
    'gold 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/14/largeicon.png',
    'platinum 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/15/largeicon.png',
    'platinum 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/16/largeicon.png',
    'platinum 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/17/largeicon.png',
    'diamond 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/18/largeicon.png',
    'diamond 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/19/largeicon.png',
    'diamond 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/20/largeicon.png',
    'ascendant 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/21/largeicon.png',
    'ascendant 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/22/largeicon.png',
    'ascendant 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/23/largeicon.png',
    'immortal 1': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/24/largeicon.png',
    'immortal 2': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/25/largeicon.png',
    'immortal 3': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/26/largeicon.png',
    'radiant': 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/27/largeicon.png',
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
