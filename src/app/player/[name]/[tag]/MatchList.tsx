'use client';

import { useState, useEffect, useMemo } from 'react';
import MatchCard from '@/components/MatchCard';
import {
    loadMatchesFromFirebase,
    saveMatchesToFirebase,
    deleteOldSeasonMatches,
    getStoredMatchIds,
    isCurrentSeason,
    CURRENT_SEASON
} from '@/lib/firebase';

interface MatchListProps {
    initialMatches: any[];
    playerName: string;
    playerTag: string;
    region: string;
    puuid: string;
}

export default function MatchList({
    initialMatches,
    playerName,
    playerTag,
    region,
    puuid
}: MatchListProps) {
    const [mounted, setMounted] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [displayCount, setDisplayCount] = useState(20);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [apiOffset, setApiOffset] = useState(10);
    const [cleanupDone, setCleanupDone] = useState(false);

    // Fix hydration mismatch - only render on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Load matches: Firebase first, then merge with API matches
    useEffect(() => {
        async function initializeMatches() {
            if (!puuid) {
                setMatches(initialMatches);
                setLoading(false);
                return;
            }

            try {
                // Step 1: Delete old season matches from Firebase
                if (!cleanupDone) {
                    const deleted = await deleteOldSeasonMatches(puuid);
                    if (deleted > 0) {
                        console.log(`🗑️ Cleaned up ${deleted} old season matches`);
                    }
                    setCleanupDone(true);
                }

                // Step 2: Load matches from Firebase (already filtered to current season)
                const firebaseMatches = await loadMatchesFromFirebase(puuid);
                console.log(`📂 Firebase: ${firebaseMatches.length} matches`);

                // Step 3: Get stored match IDs for deduplication
                const storedIds = await getStoredMatchIds(puuid);

                // Step 4: Filter API matches - only keep new ones from current season
                const newApiMatches = initialMatches.filter(match => {
                    const matchId = match.metadata?.match_id || match.meta?.id;
                    return matchId && !storedIds.has(matchId) && isCurrentSeason(match);
                });

                console.log(`🌐 API: ${newApiMatches.length} new matches to save`);

                // Step 5: Save new matches to Firebase
                if (newApiMatches.length > 0) {
                    await saveMatchesToFirebase(puuid, newApiMatches);
                }

                // Step 6: Merge all matches (Firebase + new API matches)
                const allMatches = [...firebaseMatches];
                newApiMatches.forEach(match => {
                    const matchId = match.metadata?.match_id || match.meta?.id;
                    if (!allMatches.some(m => (m.metadata?.match_id || m.meta?.id) === matchId)) {
                        allMatches.push(match);
                    }
                });

                // Sort by date (newest first)
                allMatches.sort((a, b) => {
                    const dateA = new Date(a.metadata?.started_at || a.meta?.started_at || 0);
                    const dateB = new Date(b.metadata?.started_at || b.meta?.started_at || 0);
                    return dateB.getTime() - dateA.getTime();
                });

                setMatches(allMatches);
                console.log(`✅ Total: ${allMatches.length} matches loaded`);

            } catch (e) {
                console.warn('Firebase error, using API matches only:', e);
                setMatches(initialMatches.filter(m => isCurrentSeason(m)));
            } finally {
                setLoading(false);
            }
        }

        initializeMatches();
    }, [puuid, initialMatches, cleanupDone]);

    // Load more matches from API
    const loadMoreFromAPI = async () => {
        setLoadingMore(true);
        try {
            const response = await fetch(`/api/matches?region=${region}&name=${encodeURIComponent(playerName)}&tag=${encodeURIComponent(playerTag)}&start=${apiOffset}&size=10`);
            const data = await response.json();

            if (data.matches && data.matches.length > 0) {
                const currentSeasonMatches = data.matches.filter((m: any) => isCurrentSeason(m));
                const existingIds = new Set(matches.map(m => m.metadata?.match_id || m.meta?.id));

                const newMatches = currentSeasonMatches.filter((m: any) => {
                    const id = m.metadata?.match_id || m.meta?.id;
                    return id && !existingIds.has(id);
                });

                if (newMatches.length > 0) {
                    setMatches(prev => [...prev, ...newMatches].sort((a, b) => {
                        const dateA = new Date(a.metadata?.started_at || a.meta?.started_at || 0);
                        const dateB = new Date(b.metadata?.started_at || b.meta?.started_at || 0);
                        return dateB.getTime() - dateA.getTime();
                    }));

                    await saveMatchesToFirebase(puuid, newMatches);
                    console.log(`✅ Loaded ${newMatches.length} more matches`);
                }

                setApiOffset(prev => prev + 10);
            }
        } catch (e) {
            console.error('Error loading more matches:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    const showMore = () => {
        setDisplayCount(prev => prev + 20);
    };

    const displayedMatches = matches.slice(0, displayCount);
    const hasMoreToDisplay = displayCount < matches.length;

    // Calculate stats from ALL loaded matches - MUST be before any conditional returns!
    const stats = useMemo(() => {
        let kills = 0, deaths = 0, headshots = 0, totalShots = 0, wins = 0;

        matches.forEach(match => {
            // Find player in match
            const player = match.players?.find((p: any) =>
                p.name?.toLowerCase() === playerName.toLowerCase() &&
                p.tag?.toLowerCase() === playerTag.toLowerCase()
            ) || (match.stats ? { stats: match.stats, team: match.stats.team } : null);

            if (player) {
                const s = player.stats || player;
                kills += s.kills || 0;
                deaths += s.deaths || 0;
                headshots += s.headshots || 0;
                totalShots += (s.headshots || 0) + (s.bodyshots || 0) + (s.legshots || 0);

                // Check win
                const playerTeam = player.team_id || player.team || s.team;
                if (match.teams) {
                    if (Array.isArray(match.teams)) {
                        const myTeam = match.teams.find((t: any) => t.team_id?.toLowerCase() === playerTeam?.toLowerCase());
                        if (myTeam?.won) wins++;
                    } else if (typeof match.teams.red === 'number') {
                        const myRounds = playerTeam?.toLowerCase() === 'red' ? match.teams.red : match.teams.blue;
                        const enemyRounds = playerTeam?.toLowerCase() === 'red' ? match.teams.blue : match.teams.red;
                        if (myRounds > enemyRounds) wins++;
                    }
                }
            }
        });

        const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString();
        const hs = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;
        const winrate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

        return { kd, hs, winrate, total: matches.length, wins, losses: matches.length - wins };
    }, [matches, playerName, playerTag]);

    // Show loading state during SSR and initial load
    if (!mounted || loading) {
        return (
            <div className="text-center py-12">
                <i className="fa-solid fa-spinner fa-spin text-4xl text-[#fd4556] mb-4"></i>
                <p className="text-gray-400 font-[family-name:var(--font-rajdhani)]">
                    Chargement des matchs...
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Dynamic Stats Grid - updates with all loaded matches */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="glass-panel rounded-xl p-4 text-center">
                    <i className="fa-solid fa-crosshairs text-xl text-white mb-2"></i>
                    <p className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-white">{stats.kd}</p>
                    <p className="text-gray-500 text-xs font-[family-name:var(--font-rajdhani)]">K/D Ratio</p>
                </div>
                <div className="glass-panel rounded-xl p-4 text-center">
                    <i className="fa-solid fa-bullseye text-xl text-yellow-400 mb-2"></i>
                    <p className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-yellow-400">{stats.hs}%</p>
                    <p className="text-gray-500 text-xs font-[family-name:var(--font-rajdhani)]">Headshot %</p>
                </div>
                <div className="glass-panel rounded-xl p-4 text-center">
                    <i className="fa-solid fa-trophy text-xl text-green-400 mb-2"></i>
                    <p className={`font-[family-name:var(--font-orbitron)] text-2xl font-bold ${stats.winrate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{stats.winrate}%</p>
                    <p className="text-gray-500 text-xs font-[family-name:var(--font-rajdhani)]">Winrate ({stats.wins}W/{stats.losses}L)</p>
                </div>
                <div className="glass-panel rounded-xl p-4 text-center">
                    <i className="fa-solid fa-gamepad text-xl text-[#fd4556] mb-2"></i>
                    <p className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-[#fd4556]">{stats.total}</p>
                    <p className="text-gray-500 text-xs font-[family-name:var(--font-rajdhani)]">Matchs ({CURRENT_SEASON.name})</p>
                </div>
            </div>

            {/* Season info */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-gray-400 font-[family-name:var(--font-rajdhani)]">
                    <span className="text-[#fd4556] font-bold">{matches.length}</span> matchs
                    <span className="text-gray-500 ml-2">• {CURRENT_SEASON.name}</span>
                </p>
                <span className="px-3 py-1 bg-[#fd4556]/20 text-[#fd4556] text-xs rounded-full font-[family-name:var(--font-rajdhani)]">
                    Saison actuelle uniquement
                </span>
            </div>

            {/* Match list */}
            <div className="space-y-4">
                {displayedMatches.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <i className="fa-solid fa-inbox text-4xl mb-4"></i>
                        <p>Aucun match trouvé pour cette saison</p>
                    </div>
                ) : (
                    displayedMatches.map((match, index) => (
                        <MatchCard
                            key={match.metadata?.match_id || match.meta?.id || index}
                            match={match}
                            playerName={playerName}
                            playerTag={playerTag}
                            onClick={() => setSelectedMatch(match)}
                        />
                    ))
                )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                {hasMoreToDisplay && (
                    <button
                        onClick={showMore}
                        className="px-8 py-3 bg-white/10 border border-white/20 text-white font-[family-name:var(--font-rajdhani)] rounded-lg hover:bg-white/20 transition-all"
                    >
                        <i className="fa-solid fa-chevron-down mr-2"></i>
                        Afficher {Math.min(20, matches.length - displayCount)} matchs de plus
                    </button>
                )}

                <button
                    onClick={loadMoreFromAPI}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-[#fd4556]/20 border border-[#fd4556] text-[#fd4556] font-[family-name:var(--font-rajdhani)] rounded-lg hover:bg-[#fd4556] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loadingMore ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                            Chargement...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-download mr-2"></i>
                            Charger plus de matchs (API)
                        </>
                    )}
                </button>
            </div>

            {/* Match Modal */}
            {selectedMatch && (
                <MatchModal
                    match={selectedMatch}
                    playerName={playerName}
                    playerTag={playerTag}
                    region={region}
                    onClose={() => setSelectedMatch(null)}
                />
            )}
        </div>
    );
}

// Match Modal Component - Full details with Scoreboard/Rounds tabs
function MatchModal({ match, playerName, playerTag, region, onClose }: {
    match: any;
    playerName: string;
    playerTag: string;
    region: string;
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = useState<'scoreboard' | 'rounds'>('scoreboard');
    const [fullMatch, setFullMatch] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRound, setSelectedRound] = useState<number | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

    // Load full match details with rounds
    useEffect(() => {
        async function loadMatchDetails() {
            const matchId = match.metadata?.match_id || match.meta?.id;

            if (!matchId) {
                setFullMatch(match);
                setLoading(false);
                return;
            }

            // If match already has players array, use it - NO API CALL NEEDED
            if (match.players && match.players.length > 0) {
                console.log('📋 Using existing match data (no API call)');
                setFullMatch(match);
                setLoading(false);
                return;
            }

            // ONLY fetch API if players array is missing (stored-matches format from Firebase)
            console.log('🌐 Fetching full match details from API...');
            try {
                const response = await fetch(`/api/match/${matchId}?region=${region}`);
                const data = await response.json();

                if (data.match) {
                    setFullMatch(data.match);
                } else {
                    setFullMatch(match);
                }
            } catch (e) {
                console.error('Error fetching match details:', e);
                setFullMatch(match);
            } finally {
                setLoading(false);
            }
        }

        loadMatchDetails();
    }, [match, region]);

    const metadata = fullMatch?.metadata || fullMatch?.meta || match.metadata || match.meta;
    const players = fullMatch?.players || match.players || [];
    const rounds = fullMatch?.rounds || [];
    const kills = fullMatch?.kills || [];

    // Memoize heavy calculations to reduce lag
    const { redTeam, blueTeam, redRounds, blueRounds } = useMemo(() => {
        // Sort players by score
        const redTeam = players
            .filter((p: any) => (p.team_id || p.team)?.toLowerCase() === 'red')
            .sort((a: any, b: any) => (b.stats?.score || 0) - (a.stats?.score || 0));
        const blueTeam = players
            .filter((p: any) => (p.team_id || p.team)?.toLowerCase() === 'blue')
            .sort((a: any, b: any) => (b.stats?.score || 0) - (a.stats?.score || 0));

        // Scores
        let redRounds = 0, blueRounds = 0;
        const matchData = fullMatch || match;
        if (matchData.teams) {
            if (typeof matchData.teams.red === 'number') {
                redRounds = matchData.teams.red;
                blueRounds = matchData.teams.blue;
            } else if (Array.isArray(matchData.teams)) {
                const redTeamData = matchData.teams.find((t: any) => t.team_id?.toLowerCase() === 'red');
                const blueTeamData = matchData.teams.find((t: any) => t.team_id?.toLowerCase() === 'blue');
                redRounds = redTeamData?.rounds?.won || 0;
                blueRounds = blueTeamData?.rounds?.won || 0;
            } else {
                redRounds = matchData.teams.red?.rounds_won || 0;
                blueRounds = matchData.teams.blue?.rounds_won || 0;
            }
        }

        return { redTeam, blueTeam, redRounds, blueRounds };
    }, [players, fullMatch, match]);

    const mapName = metadata?.map?.name || 'Unknown';
    const mapImage = metadata?.map?.splash || '';
    const matchDate = metadata?.started_at ? new Date(metadata.started_at) : new Date();
    const duration = metadata?.game_length_in_ms ? Math.floor(metadata.game_length_in_ms / 60000) : 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="modal-overlay absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="glass-panel rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto relative z-10 border border-[#fd4556]/30">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 w-10 h-10 flex items-center justify-center bg-black/50 rounded-full"
                >
                    <i className="fa-solid fa-times text-xl"></i>
                </button>

                {loading ? (
                    <div className="text-center py-20">
                        <i className="fa-solid fa-spinner fa-spin text-4xl text-[#fd4556] mb-4"></i>
                        <p className="text-gray-400">Chargement des détails...</p>
                    </div>
                ) : (
                    <>
                        {/* Map Header */}
                        <div
                            className="h-40 relative"
                            style={mapImage ? {
                                backgroundImage: `url(${mapImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            } : {
                                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
                            <div className="absolute bottom-0 left-0 w-full p-6">
                                <h3 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-white drop-shadow-lg">
                                    {mapName}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-300 font-[family-name:var(--font-rajdhani)]">
                                    <span>{matchDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                                    {duration > 0 && <span>• ⏱️ {duration} min</span>}
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Score */}
                            <div className="flex justify-center items-center gap-8 mb-6">
                                <div className="text-center">
                                    <p className={`text-5xl font-[family-name:var(--font-orbitron)] font-black ${redRounds > blueRounds ? 'text-green-400' : 'text-red-400'}`}>
                                        {redRounds}
                                    </p>
                                    <p className="text-sm text-red-400 font-[family-name:var(--font-rajdhani)] uppercase tracking-wider">Red</p>
                                </div>
                                <div className="text-4xl text-gray-600 font-[family-name:var(--font-orbitron)]">VS</div>
                                <div className="text-center">
                                    <p className={`text-5xl font-[family-name:var(--font-orbitron)] font-black ${blueRounds > redRounds ? 'text-green-400' : 'text-blue-400'}`}>
                                        {blueRounds}
                                    </p>
                                    <p className="text-sm text-blue-400 font-[family-name:var(--font-rajdhani)] uppercase tracking-wider">Blue</p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 mb-6 justify-center">
                                <button
                                    onClick={() => setActiveTab('scoreboard')}
                                    className={`px-4 py-2 rounded-lg font-[family-name:var(--font-rajdhani)] text-sm transition-all ${activeTab === 'scoreboard'
                                        ? 'bg-[#fd4556] text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    <i className="fa-solid fa-users mr-2"></i>Scoreboard
                                </button>
                                <button
                                    onClick={() => setActiveTab('rounds')}
                                    className={`px-4 py-2 rounded-lg font-[family-name:var(--font-rajdhani)] text-sm transition-all ${activeTab === 'rounds'
                                        ? 'bg-[#fd4556] text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    <i className="fa-solid fa-clock-rotate-left mr-2"></i>Rounds ({rounds.length})
                                </button>
                            </div>

                            {/* Scoreboard Tab */}
                            {activeTab === 'scoreboard' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Red Team */}
                                    <div className="bg-gradient-to-br from-red-900/20 to-transparent rounded-xl p-4 border border-red-500/30">
                                        <h4 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                            RED TEAM
                                        </h4>
                                        <div className="space-y-2">
                                            {redTeam.map((player: any, i: number) => (
                                                <PlayerRow
                                                    key={i}
                                                    player={player}
                                                    roundsPlayed={rounds.length || redRounds + blueRounds}
                                                    isCurrentPlayer={
                                                        player.name?.toLowerCase() === playerName.toLowerCase() &&
                                                        player.tag?.toLowerCase() === playerTag.toLowerCase()
                                                    }
                                                    onShowDetails={() => setSelectedPlayer(player)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Blue Team */}
                                    <div className="bg-gradient-to-br from-blue-900/20 to-transparent rounded-xl p-4 border border-blue-500/30">
                                        <h4 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                            BLUE TEAM
                                        </h4>
                                        <div className="space-y-2">
                                            {blueTeam.map((player: any, i: number) => (
                                                <PlayerRow
                                                    key={i}
                                                    player={player}
                                                    roundsPlayed={rounds.length || redRounds + blueRounds}
                                                    isCurrentPlayer={
                                                        player.name?.toLowerCase() === playerName.toLowerCase() &&
                                                        player.tag?.toLowerCase() === playerTag.toLowerCase()
                                                    }
                                                    onShowDetails={() => setSelectedPlayer(player)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rounds Tab */}
                            {activeTab === 'rounds' && (
                                <div className="glass-panel rounded-xl p-6">
                                    <h4 className="font-[family-name:var(--font-orbitron)] text-xl font-bold text-white mb-6 text-center">
                                        <i className="fa-solid fa-clock-rotate-left mr-2 text-[#fd4556]"></i>
                                        Round par Round
                                    </h4>

                                    {rounds.length > 0 ? (
                                        <>
                                            {/* Round buttons */}
                                            <div className="flex flex-wrap gap-2 justify-center mb-6 p-4 bg-black/30 rounded-xl">
                                                {rounds.map((round: any, i: number) => {
                                                    const winTeam = round.winning_team?.toLowerCase() || '';
                                                    const isRed = winTeam === 'red';
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => setSelectedRound(selectedRound === i ? null : i)}
                                                            className={`w-12 h-12 rounded-lg font-[family-name:var(--font-rajdhani)] text-lg font-bold transition-all hover:scale-110 ${selectedRound === i ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                                                                } ${isRed
                                                                    ? 'bg-gradient-to-br from-red-600 to-red-800 text-white border-2 border-red-400/50'
                                                                    : 'bg-gradient-to-br from-blue-600 to-blue-800 text-white border-2 border-blue-400/50'
                                                                }`}
                                                        >
                                                            {i + 1}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Selected round details */}
                                            {selectedRound !== null && rounds[selectedRound] && (
                                                <RoundDetails round={rounds[selectedRound]} roundNumber={selectedRound + 1} />
                                            )}

                                            <p className="text-center text-gray-500 text-sm mt-4">
                                                <i className="fa-solid fa-hand-pointer mr-1"></i>
                                                Clique sur un round pour voir les détails
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-center text-gray-500 py-8">
                                            <i className="fa-solid fa-circle-info mr-2"></i>
                                            Données des rounds non disponibles
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Player Details Modal */}
                {selectedPlayer && (
                    <PlayerDetailsModal
                        player={selectedPlayer}
                        rounds={rounds}
                        kills={kills}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </div>
        </div>
    );
}

// Round Details Component
function RoundDetails({ round, roundNumber }: { round: any; roundNumber: number }) {
    const winTeam = round.winning_team?.toLowerCase() || '';
    const endType = round.end_type || round.round_result || 'Unknown';

    const endTypeLabels: Record<string, string> = {
        'Eliminated': '💀 Élimination',
        'Bomb defused': '🔧 Bombe désamorcée',
        'Bomb detonated': '💥 Bombe explosée',
        'Round timer expired': '⏱️ Temps écoulé',
        'Surrendered': '🏳️ Abandon'
    };

    return (
        <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-xl p-6 border border-[#fd4556]/30">
            <div className="flex items-center justify-between mb-4">
                <h5 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-white">
                    Round {roundNumber}
                </h5>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-[family-name:var(--font-rajdhani)] ${winTeam === 'red' ? 'bg-red-500/30 text-red-400' : 'bg-blue-500/30 text-blue-400'
                        }`}>
                        {winTeam === 'red' ? '🔴 Red Team' : '🔵 Blue Team'} wins
                    </span>
                    <span className="text-gray-400 text-sm">
                        {endTypeLabels[endType] || endType}
                    </span>
                </div>
            </div>

            {/* Round stats */}
            {round.player_stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {round.player_stats.slice(0, 4).map((stat: any, i: number) => (
                        <div key={i} className="bg-black/30 rounded-lg p-3 text-center">
                            <p className="text-white font-[family-name:var(--font-rajdhani)] text-sm truncate">
                                {stat.player_display_name || 'Player'}
                            </p>
                            <p className="text-[#fd4556] font-bold">
                                {stat.kills || 0} <span className="text-gray-500 text-xs">kills</span>
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Player Row in Modal
function PlayerRow({ player, roundsPlayed, isCurrentPlayer, onShowDetails }: {
    player: any;
    roundsPlayed: number;
    isCurrentPlayer: boolean;
    onShowDetails?: () => void;
}) {
    const stats = player.stats || {};
    const kda = `${stats.kills || 0}/${stats.deaths || 0}/${stats.assists || 0}`;

    // Calculate ACS with actual rounds played
    const acs = roundsPlayed > 0 ? Math.round((stats.score || 0) / roundsPlayed) : 0;

    // Calculate HS%
    const headshots = stats.headshots || 0;
    const bodyshots = stats.bodyshots || 0;
    const legshots = stats.legshots || 0;
    const total = headshots + bodyshots + legshots;
    const hsPercent = total > 0 ? Math.round((headshots / total) * 100) : 0;

    // Agent info
    const agentName = player.character || player.agent?.name || '-';
    const agentId = player.agent?.id;
    const agentIcon = agentId
        ? `https://media.valorant-api.com/agents/${agentId}/displayicon.png`
        : player.assets?.agent?.small || '';

    // K/D ratio
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills || 0;

    // Player rank
    const rankName = player.currenttier_patched || player.tier?.name || '';

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isCurrentPlayer ? 'bg-[#fd4556]/20 border border-[#fd4556]/40 ring-1 ring-[#fd4556]/50' : 'bg-white/5 hover:bg-white/10'}`}>
            {/* Agent icon */}
            {agentIcon && (
                <img
                    src={agentIcon}
                    alt={agentName}
                    className="w-10 h-10 rounded-lg"
                    loading="lazy"
                />
            )}

            {/* Player info */}
            <div className="flex-1 min-w-0">
                <p className={`font-[family-name:var(--font-rajdhani)] text-sm truncate ${isCurrentPlayer ? 'text-[#fd4556] font-bold' : 'text-white'}`}>
                    {player.name}#{player.tag}
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{agentName}</span>
                    {rankName && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">{rankName}</span>
                    )}
                </div>
            </div>

            {/* KDA */}
            <div className="text-center px-3">
                <p className="font-[family-name:var(--font-rajdhani)] text-sm text-white font-bold">{kda}</p>
                <p className="text-xs text-gray-500">K/D/A</p>
            </div>

            {/* K/D Ratio */}
            <div className="text-center px-3 hidden sm:block">
                <p className={`font-[family-name:var(--font-rajdhani)] text-sm font-bold ${Number(kd) >= 1 ? 'text-green-400' : 'text-red-400'}`}>{kd}</p>
                <p className="text-xs text-gray-500">K/D</p>
            </div>

            {/* ACS */}
            <div className="text-center px-3">
                <p className="font-[family-name:var(--font-rajdhani)] text-sm text-yellow-400 font-bold">{acs}</p>
                <p className="text-xs text-gray-500">ACS</p>
            </div>

            {/* HS% */}
            <div className="text-center px-3 hidden md:block">
                <p className="font-[family-name:var(--font-rajdhani)] text-sm text-cyan-400">{hsPercent}%</p>
                <p className="text-xs text-gray-500">HS%</p>
            </div>

            {/* Details Button */}
            {onShowDetails && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowDetails();
                    }}
                    className="w-8 h-8 rounded-full bg-gray-700/50 hover:bg-[#fd4556]/50 text-gray-400 hover:text-white text-xs flex items-center justify-center transition-all"
                    title="Voir les détails du joueur"
                >
                    <i className="fa-solid fa-chart-bar"></i>
                </button>
            )}
        </div>
    );
}

// Player Details Modal - Shows detailed stats for a specific player
function PlayerDetailsModal({ player, rounds, kills, onClose }: {
    player: any;
    rounds: any[];
    kills: any[];
    onClose: () => void;
}) {
    const stats = player.stats || {};
    const abilities = player.ability_casts || {};
    const roundsPlayed = rounds.length || 1;

    // Calculate stats
    const acs = Math.round((stats.score || 0) / roundsPlayed);
    const headshots = stats.headshots || 0;
    const bodyshots = stats.bodyshots || 0;
    const legshots = stats.legshots || 0;
    const totalShots = headshots + bodyshots + legshots;
    const hsPercent = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;
    const damageDealt = player.damage_made || stats.damage?.dealt || stats.damage || 0;

    // Ability casts - handle both API formats
    const cCast = abilities.c_cast || abilities.grenade || 0;
    const qCast = abilities.q_cast || abilities.ability1 || 0;
    const eCast = abilities.e_cast || abilities.ability2 || 0;
    const xCast = abilities.x_cast || abilities.ultimate || 0;

    // Agent info
    const agentName = player.character || player.agent?.name || 'Unknown';
    const agentIcon = player.assets?.agent?.small ||
        (player.agent?.id ? `https://media.valorant-api.com/agents/${player.agent.id}/displayicon.png` : '');
    const rankName = player.currenttier_patched || player.tier?.name || '';

    // Get player's kills and deaths per round
    const playerPuuid = player.puuid;
    const playerKills = kills.filter((k: any) => k.killer?.puuid === playerPuuid || k.killer_puuid === playerPuuid);
    const playerDeaths = kills.filter((k: any) => k.victim?.puuid === playerPuuid || k.victim_puuid === playerPuuid);

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-[#fd4556]/30 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-[#fd4556]/20 to-purple-500/20 p-5 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        {agentIcon && (
                            <img
                                src={agentIcon}
                                alt={agentName}
                                className="w-20 h-20 rounded-xl border-2 border-[#fd4556]/50 shadow-lg"
                            />
                        )}
                        <div className="flex-1">
                            <h2 className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-white">
                                {player.name}<span className="text-gray-400">#{player.tag}</span>
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[#fd4556] font-[family-name:var(--font-rajdhani)]">{agentName}</span>
                                {rankName && (
                                    <span className="px-3 py-1 bg-gradient-to-r from-[#fd4556]/30 to-purple-500/30 rounded-full text-white font-[family-name:var(--font-rajdhani)] text-sm border border-[#fd4556]/30">
                                        🏆 {rankName}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="p-5 overflow-y-auto flex-1">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10">
                            <p className="font-[family-name:var(--font-rajdhani)] text-2xl text-white font-bold">
                                {stats.kills || 0}/{stats.deaths || 0}/{stats.assists || 0}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">K/D/A</p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/0 border border-green-500/20">
                            <p className="font-[family-name:var(--font-rajdhani)] text-2xl text-green-400 font-bold">{acs}</p>
                            <p className="text-xs text-gray-400 mt-1">ACS</p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/0 border border-orange-500/20">
                            <p className="font-[family-name:var(--font-rajdhani)] text-2xl text-orange-400 font-bold">{damageDealt}</p>
                            <p className="text-xs text-gray-400 mt-1">Damage</p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-500/0 border border-yellow-500/20">
                            <p className="font-[family-name:var(--font-rajdhani)] text-2xl text-yellow-400 font-bold">{hsPercent}%</p>
                            <p className="text-xs text-gray-400 mt-1">HS%</p>
                        </div>
                    </div>

                    {/* Shot Distribution & Abilities */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* Shot Distribution */}
                        <div className="p-3 rounded-lg bg-black/30">
                            <p className="text-white font-bold mb-2 font-[family-name:var(--font-rajdhani)]">Distribution des tirs</p>
                            <div className="space-y-1 text-sm">
                                <p>🎯 Head: <span className="text-yellow-400">{headshots}</span></p>
                                <p>💪 Body: <span className="text-white">{bodyshots}</span></p>
                                <p>🦵 Leg: <span className="text-gray-400">{legshots}</span></p>
                            </div>
                        </div>

                        {/* Abilities */}
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-900/30 to-black/30 border border-purple-500/20">
                            <p className="text-white font-bold mb-3 font-[family-name:var(--font-rajdhani)]">✨ Abilities utilisées</p>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="text-center p-2 rounded bg-black/30">
                                    <div className="w-8 h-8 mx-auto mb-1 bg-purple-500/20 rounded flex items-center justify-center text-xs text-purple-400 font-bold">C</div>
                                    <p className="text-purple-400 font-[family-name:var(--font-rajdhani)] font-bold text-lg">{cCast}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-black/30">
                                    <div className="w-8 h-8 mx-auto mb-1 bg-purple-500/20 rounded flex items-center justify-center text-xs text-purple-400 font-bold">Q</div>
                                    <p className="text-purple-400 font-[family-name:var(--font-rajdhani)] font-bold text-lg">{qCast}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-black/30">
                                    <div className="w-8 h-8 mx-auto mb-1 bg-purple-500/20 rounded flex items-center justify-center text-xs text-purple-400 font-bold">E</div>
                                    <p className="text-purple-400 font-[family-name:var(--font-rajdhani)] font-bold text-lg">{eCast}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-black/30">
                                    <div className="w-8 h-8 mx-auto mb-1 bg-yellow-500/20 rounded flex items-center justify-center text-xs text-yellow-400 font-bold">X</div>
                                    <p className="text-yellow-400 font-[family-name:var(--font-rajdhani)] font-bold text-lg">{xCast}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Round by Round */}
                    <div>
                        <p className="text-white font-bold mb-3 font-[family-name:var(--font-rajdhani)]">Round par Round</p>
                        <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                            {rounds.map((round: any, i: number) => {
                                const roundKills = playerKills.filter((k: any) => k.round === i);
                                const roundDeaths = playerDeaths.filter((k: any) => k.round === i);
                                const won = round.winning_team?.toLowerCase() === player.team?.toLowerCase() ||
                                    round.winning_team?.toLowerCase() === (player.team_id || '').toLowerCase();

                                // Build kills text
                                const killsText = roundKills.map((k: any) => {
                                    const victim = k.victim?.name || k.victim_display_name || '?';
                                    const weapon = k.damage_weapon_name || k.weapon?.name || '';
                                    return `${victim} (${weapon})`;
                                }).join(', ');

                                const deathBy = roundDeaths.length > 0
                                    ? roundDeaths[0]?.killer?.name || roundDeaths[0]?.killer_display_name || '?'
                                    : '';

                                return (
                                    <div
                                        key={i}
                                        className={`p-2 rounded bg-black/40 border-l-2 ${won ? 'border-green-500' : 'border-red-500'}`}
                                    >
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={`font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>R{i + 1}</span>
                                            <span className="text-gray-500">
                                                {round.end_type || round.result || ''}
                                            </span>
                                        </div>
                                        {roundKills.length > 0 && (
                                            <div className="text-xs text-green-300 mt-1">
                                                💀 {roundKills.length}K: {killsText}
                                            </div>
                                        )}
                                        {deathBy && (
                                            <div className="text-xs text-red-400 mt-1">☠️ {deathBy}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
