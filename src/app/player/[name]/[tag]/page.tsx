import { notFound } from 'next/navigation';
import ProfileCard from '@/components/ProfileCard';
import MatchCard from '@/components/MatchCard';
import MatchList from './MatchList';

// Server-side data fetching
async function getPlayerData(name: string, tag: string) {
    const apiKey = process.env.HENRIK_API_KEY;
    const baseUrl = 'https://api.henrikdev.xyz';

    if (!apiKey) {
        console.error('HENRIK_API_KEY is not configured');
        throw new Error('API key not configured');
    }

    try {
        // Fetch account info
        const accountRes = await fetch(
            `${baseUrl}/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?api_key=${apiKey}`,
            { next: { revalidate: 60 } }
        );
        const accountData = await accountRes.json();

        console.log('Account API response status:', accountData.status);

        if (accountData.status !== 200) {
            console.log('Account not found or error:', accountData);
            return null;
        }

        const account = accountData.data;
        const region = account.region || 'eu';

        // Fetch MMR data
        let mmr = null;
        try {
            const mmrRes = await fetch(
                `${baseUrl}/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?api_key=${apiKey}`,
                { next: { revalidate: 60 } }
            );
            const mmrData = await mmrRes.json();
            if (mmrData.status === 200) {
                mmr = mmrData.data;
            }
        } catch (e) {
            console.warn('MMR not available');
        }

        // Fetch recent matches (no cache - data too large for Vercel 2MB limit)
        let matches: any[] = [];
        try {
            const matchesRes = await fetch(
                `${baseUrl}/valorant/v4/matches/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=competitive&size=10&api_key=${apiKey}`,
                { cache: 'no-store' }
            );
            const matchesData = await matchesRes.json();
            if (matchesData.status === 200 && matchesData.data) {
                matches = matchesData.data;
            }
        } catch (e) {
            console.warn('Matches not available');
        }

        return { account, mmr, matches };
    } catch (error) {
        console.error('Error fetching player data:', error);
        return null;
    }
}

interface PageProps {
    params: Promise<{ name: string; tag: string }>;
}

export default async function PlayerPage({ params }: PageProps) {
    const { name, tag } = await params;
    const decodedName = decodeURIComponent(name);
    const decodedTag = decodeURIComponent(tag);

    const data = await getPlayerData(decodedName, decodedTag);

    if (!data) {
        notFound();
    }

    return (
        <div>
            {/* Profile Card */}
            <ProfileCard account={data.account} mmr={data.mmr} />

            {/* Match History - includes dynamic stats that update with all loaded matches */}
            <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-[family-name:var(--font-orbitron)] text-xl font-bold text-white mb-6">
                    <i className="fa-solid fa-history mr-3 text-[#fd4556]"></i>HISTORIQUE DES MATCHS
                </h3>
                <MatchList
                    initialMatches={data.matches}
                    playerName={decodedName}
                    playerTag={decodedTag}
                    region={data.account.region || 'eu'}
                    puuid={data.account.puuid}
                />
            </div>
        </div>
    );
}

// Stats Card Component
function StatsCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
    return (
        <div className="glass-panel rounded-xl p-4 text-center">
            <i className={`fa-solid ${icon} text-2xl ${color} mb-2`}></i>
            <p className={`font-[family-name:var(--font-orbitron)] text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs font-[family-name:var(--font-rajdhani)]">{label}</p>
        </div>
    );
}

// Calculate KD from matches
function calculateKD(matches: any[], name: string, tag: string): string {
    let kills = 0, deaths = 0;
    matches.forEach(match => {
        const player = match.players?.find((p: any) =>
            p.name.toLowerCase() === name.toLowerCase() &&
            p.tag.toLowerCase() === tag.toLowerCase()
        );
        if (player?.stats) {
            kills += player.stats.kills || 0;
            deaths += player.stats.deaths || 0;
        }
    });
    return deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString();
}

// Calculate HS% from matches
function calculateHS(matches: any[], name: string, tag: string): number {
    let headshots = 0, total = 0;
    matches.forEach(match => {
        const player = match.players?.find((p: any) =>
            p.name.toLowerCase() === name.toLowerCase() &&
            p.tag.toLowerCase() === tag.toLowerCase()
        );
        if (player?.stats) {
            headshots += player.stats.headshots || 0;
            total += (player.stats.headshots || 0) + (player.stats.bodyshots || 0) + (player.stats.legshots || 0);
        }
    });
    return total > 0 ? Math.round((headshots / total) * 100) : 0;
}

// Calculate winrate from matches
function calculateWinrate(matches: any[], name: string, tag: string): number {
    let wins = 0;
    matches.forEach(match => {
        const player = match.players?.find((p: any) =>
            p.name.toLowerCase() === name.toLowerCase() &&
            p.tag.toLowerCase() === tag.toLowerCase()
        );
        if (player) {
            const playerTeam = player.team_id || player.team;
            if (Array.isArray(match.teams)) {
                const myTeam = match.teams.find((t: any) => t.team_id?.toLowerCase() === playerTeam?.toLowerCase());
                if (myTeam?.won) wins++;
            }
        }
    });
    return matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;
}
