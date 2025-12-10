import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, Database } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyC4wbkceT_vAWdBpYs7KhBQxjgkiDvyG9c",
    authDomain: "red-empire-103d7.firebaseapp.com",
    databaseURL: "https://red-empire-103d7-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "red-empire-103d7",
    storageBucket: "red-empire-103d7.firebasestorage.app",
    messagingSenderId: "1002924043244",
    appId: "1:1002924043244:web:e76002c3dc8810017faec9"
};

let db: Database | null = null;

function getDb() {
    if (!db) {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
    }
    return db;
}

// Current season - Episode 9 Act 3
export const CURRENT_SEASON = {
    id: 'v25a6',
    uuid: '4c4b8cff-43eb-13d3-8f14-96b783c90cd2',
    name: 'Episode 9 - Act III'
};

// Season list for filtering
export const SEASONS = [
    { id: 'v25a6', uuid: '52dd6f00-463a-18a1-80aa-649c3e38a59e', name: 'Episode 9 - Act III' },
    { id: 'v25a5', uuid: 'f2e32730-4655-8ff2-24f7-c5a8eb68f503', name: 'Episode 9 - Act II' },
    { id: 'v25a4', uuid: '10067180-4a7b-e509-0993-ca9f24ea1b07', name: 'Episode 9 - Act I' },
    { id: 'v24a3', uuid: 'e94d2ea8-4b13-5819-98fe-8d920d0f5fc5', name: 'Episode 8 - Act III' },
];

// Get season from match
export function getMatchSeason(match: any): string | null {
    const metadata = match.metadata || match.meta;
    return metadata?.season?.id || metadata?.season_id || null;
}

// Check if match is from current season
export function isCurrentSeason(match: any): boolean {
    const seasonId = getMatchSeason(match);
    return seasonId === CURRENT_SEASON.uuid;
}

// Save matches to Firebase (only current season)
export async function saveMatchesToFirebase(puuid: string, matches: any[]) {
    if (!puuid || matches.length === 0) return;

    const database = getDb();
    const matchesRef = ref(database, `valorant/matches/${puuid}`);

    try {
        const snapshot = await get(matchesRef);
        const existingMatches = snapshot.val() || {};

        const updates: Record<string, any> = {};
        let savedCount = 0;

        matches.forEach(match => {
            const matchId = match.metadata?.match_id || match.meta?.id;
            // Only save current season matches
            if (matchId && !existingMatches[matchId] && isCurrentSeason(match)) {
                updates[matchId] = match;
                savedCount++;
            }
        });

        if (Object.keys(updates).length > 0) {
            await update(matchesRef, updates);
            console.log(`✅ Saved ${savedCount} new matches to Firebase`);
        }
    } catch (error) {
        console.error('Error saving to Firebase:', error);
    }
}

// Load matches from Firebase (filtered to current season)
export async function loadMatchesFromFirebase(puuid: string): Promise<any[]> {
    if (!puuid) return [];

    const database = getDb();
    const matchesRef = ref(database, `valorant/matches/${puuid}`);

    try {
        const snapshot = await get(matchesRef);
        const data = snapshot.val();

        if (!data) return [];

        const allMatches = Object.values(data) as any[];

        // Filter to current season only
        const currentSeasonMatches = allMatches.filter(match => isCurrentSeason(match));

        // Sort by date (newest first)
        currentSeasonMatches.sort((a: any, b: any) => {
            const dateA = new Date(a.metadata?.started_at || a.meta?.started_at || 0);
            const dateB = new Date(b.metadata?.started_at || b.meta?.started_at || 0);
            return dateB.getTime() - dateA.getTime();
        });

        console.log(`📂 Loaded ${currentSeasonMatches.length} matches from Firebase (current season)`);
        return currentSeasonMatches;
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        return [];
    }
}

// Delete old season matches from Firebase
export async function deleteOldSeasonMatches(puuid: string): Promise<number> {
    if (!puuid) return 0;

    const database = getDb();
    const matchesRef = ref(database, `valorant/matches/${puuid}`);

    try {
        const snapshot = await get(matchesRef);
        const data = snapshot.val();

        if (!data) return 0;

        const matchesToDelete: string[] = [];

        Object.entries(data).forEach(([matchId, match]) => {
            if (!isCurrentSeason(match as any)) {
                matchesToDelete.push(matchId);
            }
        });

        // Delete each old match
        for (const matchId of matchesToDelete) {
            const matchRef = ref(database, `valorant/matches/${puuid}/${matchId}`);
            await remove(matchRef);
        }

        if (matchesToDelete.length > 0) {
            console.log(`🗑️ Deleted ${matchesToDelete.length} old season matches from Firebase`);
        }

        return matchesToDelete.length;
    } catch (error) {
        console.error('Error deleting old matches:', error);
        return 0;
    }
}

// Get newest match timestamp from Firebase
export async function getNewestMatchTimestamp(puuid: string): Promise<Date | null> {
    if (!puuid) return null;

    const database = getDb();
    const matchesRef = ref(database, `valorant/matches/${puuid}`);

    try {
        const snapshot = await get(matchesRef);
        const data = snapshot.val();

        if (!data) return null;

        const matches = Object.values(data) as any[];
        if (matches.length === 0) return null;

        // Find newest match
        let newestDate = new Date(0);
        matches.forEach(match => {
            const date = new Date(match.metadata?.started_at || match.meta?.started_at || 0);
            if (date > newestDate) {
                newestDate = date;
            }
        });

        return newestDate;
    } catch (error) {
        console.error('Error getting newest match timestamp:', error);
        return null;
    }
}

// Get all match IDs from Firebase (for deduplication)
export async function getStoredMatchIds(puuid: string): Promise<Set<string>> {
    if (!puuid) return new Set();

    const database = getDb();
    const matchesRef = ref(database, `valorant/matches/${puuid}`);

    try {
        const snapshot = await get(matchesRef);
        const data = snapshot.val();

        if (!data) return new Set();

        return new Set(Object.keys(data));
    } catch (error) {
        console.error('Error getting match IDs:', error);
        return new Set();
    }
}
