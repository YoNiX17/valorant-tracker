'use client';

import { useState, useEffect } from 'react';
import { getRankImage } from '@/lib/api';

interface ProfileCardProps {
    account: {
        name: string;
        tag: string;
        region: string;
        account_level: number;
        card?: string | {
            wide?: string;
            small?: string;
            large?: string;
        };
    };
    mmr?: {
        current?: {
            tier?: { name?: string };
            rr?: number;
            rr_change_to_last_game?: number;
        };
        peak?: {
            tier?: { name?: string };
            season?: { short?: string };
        };
        seasonal?: Array<{
            wins?: number;
            games?: number;
        }>;
    };
}

export default function ProfileCard({ account, mmr }: ProfileCardProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentRank = mmr?.current?.tier?.name || 'Unranked';
    const rankIcon = getRankImage(currentRank);
    const currentRR = mmr?.current?.rr || 0;
    const rrChange = mmr?.current?.rr_change_to_last_game || 0;

    // Peak rank
    const peakRank = mmr?.peak?.tier?.name || currentRank;
    const peakSeason = mmr?.peak?.season?.short || '-';
    const peakIcon = getRankImage(peakRank);

    // Season stats
    const seasonStats = mmr?.seasonal?.[0];
    const wins = seasonStats?.wins || 0;
    const games = seasonStats?.games || 0;
    const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;

    // Get card images - handle both string (UUID) and object formats
    let cardWide: string | null = null;
    let cardSmall: string | null = null;

    if (typeof account.card === 'string') {
        // Card is a UUID - use valorant-api.com
        cardWide = `https://media.valorant-api.com/playercards/${account.card}/wideart.png`;
        cardSmall = `https://media.valorant-api.com/playercards/${account.card}/smallart.png`;
    } else if (account.card) {
        // Card is an object with URLs
        cardWide = account.card.wide || null;
        cardSmall = account.card.small || null;
    }

    // Show skeleton during SSR to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="glass-panel rounded-2xl overflow-hidden mb-8 animate-pulse">
                <div className="h-56 md:h-64 bg-gray-800"></div>
                <div className="p-6 bg-gradient-to-r from-[#0a0a0a] to-[#111]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="h-24 bg-gray-800 rounded-xl"></div>
                        <div className="h-24 bg-gray-800 rounded-xl"></div>
                        <div className="h-24 bg-gray-800 rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl overflow-hidden mb-8">
            {/* Banner - Full width player card */}
            <div
                className="h-56 md:h-64 relative"
                style={cardWide ? {
                    backgroundImage: `url(${cardWide})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                } : {
                    background: 'linear-gradient(135deg, #bd2130 0%, #dc3545 50%, #bd2130 100%)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent"></div>

                {/* Player name overlay on banner */}
                <div className="absolute bottom-0 left-0 w-full p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
                        {/* Avatar */}
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-[#fd4556] shadow-2xl bg-gray-900 overflow-hidden flex-shrink-0">
                            {cardSmall && (
                                <img
                                    src={cardSmall}
                                    alt="Player Card"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            )}
                        </div>

                        {/* Name & Level */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h2 className="font-[family-name:var(--font-orbitron)] text-3xl md:text-4xl font-black text-white drop-shadow-lg">
                                    {account.name}
                                </h2>
                                <span className="text-[#fd4556] font-[family-name:var(--font-rajdhani)] text-xl drop-shadow-lg">#{account.tag}</span>
                            </div>
                            <div className="flex items-center gap-4 text-gray-300 font-[family-name:var(--font-rajdhani)]">
                                <span className="px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full text-sm">
                                    <i className="fa-solid fa-globe mr-1"></i>{account.region?.toUpperCase() || 'EU'}
                                </span>
                                <span className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full text-sm">
                                    <i className="fa-solid fa-star text-yellow-500"></i>
                                    <span>Niveau <strong className="text-white">{account.account_level || 0}</strong></span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rank Info Section */}
            <div className="p-6 bg-gradient-to-r from-[#0a0a0a] to-[#111]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Current Rank */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-[#fd4556]/20">
                        <img
                            src={rankIcon}
                            alt={currentRank}
                            width={64}
                            height={64}
                            loading="lazy"
                        />
                        <div>
                            <p className="text-xs text-gray-500 font-[family-name:var(--font-rajdhani)] uppercase">Rang Actuel</p>
                            <p className="font-[family-name:var(--font-orbitron)] font-bold text-white text-lg">{currentRank}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 font-[family-name:var(--font-rajdhani)] text-sm">{currentRR} RR</span>
                                {rrChange !== 0 && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-[family-name:var(--font-rajdhani)] ${rrChange > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {rrChange > 0 ? '+' : ''}{rrChange}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Peak Rank */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-yellow-500/20">
                        <img
                            src={peakIcon}
                            alt={peakRank}
                            width={64}
                            height={64}
                            loading="lazy"
                        />
                        <div>
                            <p className="text-xs text-gray-500 font-[family-name:var(--font-rajdhani)] uppercase">Peak Rank</p>
                            <p className="font-[family-name:var(--font-orbitron)] font-bold text-yellow-400 text-lg">{peakRank}</p>
                            <span className="text-gray-500 font-[family-name:var(--font-rajdhani)] text-sm">{peakSeason}</span>
                        </div>
                    </div>

                    {/* Season Stats */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs text-gray-500 font-[family-name:var(--font-rajdhani)] uppercase mb-3">Stats Saison</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="font-[family-name:var(--font-orbitron)] font-bold text-green-400 text-lg">{wins}</p>
                                <p className="text-xs text-gray-500">Victoires</p>
                            </div>
                            <div>
                                <p className="font-[family-name:var(--font-orbitron)] font-bold text-white text-lg">{games}</p>
                                <p className="text-xs text-gray-500">Parties</p>
                            </div>
                            <div>
                                <p className={`font-[family-name:var(--font-orbitron)] font-bold text-lg ${winrate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winrate}%</p>
                                <p className="text-xs text-gray-500">Winrate</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
