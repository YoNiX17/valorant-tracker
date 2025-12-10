'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchForm() {
    const [riotId, setRiotId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!riotId.includes('#')) {
            setError('Format invalide. Utilisez: Nom#Tag');
            return;
        }

        const [name, tag] = riotId.split('#');
        if (!name || !tag) {
            setError('Le nom et le tag sont requis');
            return;
        }

        setLoading(true);
        setError('');

        // Navigate to player page (SSR will handle the API call)
        router.push(`/player/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    };

    return (
        <div className="glass-panel rounded-2xl p-8 max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-[#fd4556]"></i>
                    <input
                        type="text"
                        value={riotId}
                        onChange={(e) => setRiotId(e.target.value)}
                        placeholder="Riot ID (ex: TenZ#TenZ)"
                        className="search-input w-full pl-12 pr-4 py-4 rounded-xl text-white font-[family-name:var(--font-rajdhani)] text-lg placeholder-gray-500"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-[#fd4556] to-[#dc3545] hover:from-[#ff6b6b] hover:to-[#fd4556] text-white font-[family-name:var(--font-orbitron)] font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-[#fd4556]/30 disabled:opacity-50"
                >
                    {loading ? (
                        <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Recherche...</>
                    ) : (
                        <><i className="fa-solid fa-search mr-2"></i>RECHERCHER</>
                    )}
                </button>
            </form>

            {error && (
                <p className="mt-4 text-red-400 text-center font-[family-name:var(--font-rajdhani)]">
                    <i className="fa-solid fa-exclamation-triangle mr-2"></i>{error}
                </p>
            )}
        </div>
    );
}
