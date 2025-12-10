import SearchForm from '@/components/SearchForm';

export default function Home() {
  return (
    <div className="text-center">
      {/* Hero Section */}
      <section className="mb-12">
        <div className="mb-6">
          <span className="text-xs font-[family-name:var(--font-rajdhani)] font-bold tracking-[0.2em] text-[#fd4556] uppercase">
            <i className="fa-solid fa-crosshairs mr-2"></i>PERSONAL STATS TRACKER
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-orbitron)] text-4xl md:text-6xl font-black text-white mb-4">
          <span className="glitch" data-text="VALORANT">VALORANT</span>{' '}
          <span className="gradient-text">TRACKER</span>
        </h1>
        <p className="text-gray-400 font-[family-name:var(--font-rajdhani)] text-lg max-w-2xl mx-auto">
          Suivez vos statistiques, votre MMR et votre historique de matchs
        </p>
      </section>

      {/* Search Section */}
      <section className="mb-12">
        <SearchForm />
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        <div className="glass-panel rounded-xl p-6 text-center">
          <i className="fa-solid fa-chart-line text-3xl text-[#fd4556] mb-4"></i>
          <h3 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-white mb-2">Statistiques Détaillées</h3>
          <p className="text-gray-400 font-[family-name:var(--font-rajdhani)] text-sm">
            K/D, HS%, Winrate et plus encore
          </p>
        </div>
        <div className="glass-panel rounded-xl p-6 text-center">
          <i className="fa-solid fa-trophy text-3xl text-yellow-500 mb-4"></i>
          <h3 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-white mb-2">Historique Complet</h3>
          <p className="text-gray-400 font-[family-name:var(--font-rajdhani)] text-sm">
            Tous vos matchs classés sauvegardés
          </p>
        </div>
        <div className="glass-panel rounded-xl p-6 text-center">
          <i className="fa-solid fa-crown text-3xl text-purple-500 mb-4"></i>
          <h3 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-white mb-2">Peak Rank</h3>
          <p className="text-gray-400 font-[family-name:var(--font-rajdhani)] text-sm">
            Votre meilleur rang de tous les temps
          </p>
        </div>
      </section>
    </div>
  );
}
