'use client';

import { useState, useEffect } from 'react';
import { getTimeAgo } from '@/lib/api';

interface MatchCardProps {
    match: any;
    playerName: string;
    playerTag: string;
    onClick: () => void;
    onDetailsClick?: () => void;
}

export default function MatchCard({ match, playerName, playerTag, onClick, onDetailsClick }: MatchCardProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const metadata = match.meta || match.metadata;

    // Find player stats
    let stats = null;
    let playerTeam = null;

    if (match.stats) {
        stats = match.stats;
        playerTeam = stats.team?.toLowerCase();
    } else if (match.players) {
        const player = match.players.find((p: any) =>
            p.name.toLowerCase() === playerName.toLowerCase() &&
            p.tag.toLowerCase() === playerTag.toLowerCase()
        );
        if (player) {
            stats = player.stats;
            playerTeam = player.team_id || player.team;
        }
    }

    if (!stats) return null;

    // Calculate win/loss
    let isWin = false;
    let isDraw = false;
    let myTeamRounds = 0;
    let enemyTeamRounds = 0;

    if (match.teams) {
        if (typeof match.teams.red === 'number') {
            const redScore = match.teams.red || 0;
            const blueScore = match.teams.blue || 0;
            if (playerTeam === 'red') {
                myTeamRounds = redScore;
                enemyTeamRounds = blueScore;
            } else {
                myTeamRounds = blueScore;
                enemyTeamRounds = redScore;
            }
            isWin = myTeamRounds > enemyTeamRounds;
            isDraw = myTeamRounds === enemyTeamRounds;
        } else if (Array.isArray(match.teams)) {
            const myTeam = match.teams.find((t: any) => t.team_id?.toLowerCase() === playerTeam?.toLowerCase());
            const enemyTeam = match.teams.find((t: any) => t.team_id?.toLowerCase() !== playerTeam?.toLowerCase());
            myTeamRounds = myTeam?.rounds?.won || 0;
            enemyTeamRounds = enemyTeam?.rounds?.won || 0;
            isWin = myTeam?.won === true;
            isDraw = myTeamRounds === enemyTeamRounds;
        }
    }

    const score = `${myTeamRounds} - ${enemyTeamRounds}`;
    const kda = `${stats.kills || 0}/${stats.deaths || 0}/${stats.assists || 0}`;
    const kdRatio = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills || 0;

    // Agent - check multiple sources
    const player = match.players?.find((p: any) =>
        p.name?.toLowerCase() === playerName.toLowerCase() &&
        p.tag?.toLowerCase() === playerTag.toLowerCase()
    );
    const agentName = player?.character || player?.agent?.name || match.stats?.character?.name || 'Unknown';
    const agentId = player?.agent?.id || match.stats?.character?.id;
    const agentIcon = agentId ? `https://media.valorant-api.com/agents/${agentId}/displayicon.png` : '';

    // Map & time
    const mapName = metadata?.map?.name || 'Unknown';
    const modeName = metadata?.mode || metadata?.queue?.name || 'Competitive';
    const matchDate = metadata?.started_at ? new Date(metadata.started_at) : new Date();

    // IMPORTANT: Only render time-sensitive data on client to avoid hydration mismatch
    const timeAgo = mounted ? getTimeAgo(matchDate) : '...';
    const dateStr = mounted ? matchDate.toLocaleDateString() : '';

    return (
        <div
            className={`match-card glass-panel rounded-xl p-6 border border-[#fd4556]/20 cursor-pointer hover:border-[#fd4556]/50 transition-all ${isDraw ? 'match-draw' : isWin ? 'match-win' : 'match-loss'}`}
        >
            <div className="flex items-center gap-4 flex-wrap">
                {/* Agent */}
                <div className="flex items-center gap-3" onClick={onClick}>
                    {agentIcon && (
                        <img
                            src={agentIcon}
                            alt={agentName}
                            width={48}
                            height={48}
                            className="agent-icon"
                            loading="lazy"
                        />
                    )}
                    <div>
                        <p className="font-[family-name:var(--font-orbitron)] font-bold text-white">{agentName}</p>
                        <p className="text-xs text-gray-500 font-[family-name:var(--font-rajdhani)]">{modeName}</p>
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 text-center hidden md:block" onClick={onClick}>
                    <p className="font-[family-name:var(--font-rajdhani)] text-gray-400">{mapName}</p>
                </div>

                {/* Score */}
                <div className="text-center px-6" onClick={onClick}>
                    <p className={`font-[family-name:var(--font-orbitron)] text-2xl font-black ${isDraw ? 'text-yellow-400' : isWin ? 'text-green-400' : 'text-red-400'}`}>
                        {score}
                    </p>
                    <p className={`text-xs font-[family-name:var(--font-rajdhani)] ${isDraw ? 'text-yellow-500' : isWin ? 'text-green-500' : 'text-red-500'}`}>
                        {isDraw ? 'DRAW' : isWin ? 'VICTOIRE' : 'DÉFAITE'}
                    </p>
                </div>

                {/* KDA */}
                <div className="text-center px-4" onClick={onClick}>
                    <p className="font-[family-name:var(--font-rajdhani)] text-lg text-white font-bold">{kda}</p>
                    <p className="text-xs text-gray-500">K/D: <span className={Number(kdRatio) >= 1 ? 'text-green-400' : 'text-red-400'}>{kdRatio}</span></p>
                </div>

                {/* Time */}
                <div className="text-right" onClick={onClick}>
                    <p className="text-sm text-gray-500 font-[family-name:var(--font-rajdhani)]">{timeAgo}</p>
                    <p className="text-xs text-gray-600">{dateStr}</p>
                </div>

                {/* Details Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onDetailsClick) onDetailsClick();
                        else onClick();
                    }}
                    className="px-4 py-2 bg-[#fd4556]/20 hover:bg-[#fd4556]/40 border border-[#fd4556]/30 rounded-lg text-[#fd4556] font-[family-name:var(--font-rajdhani)] text-sm transition-all hover:text-white"
                >
                    <i className="fa-solid fa-info-circle mr-1"></i>Détails
                </button>
            </div>
        </div>
    );
}

