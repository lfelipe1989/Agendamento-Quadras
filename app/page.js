import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-coral mb-5">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <h1 className="font-display text-6xl tracking-wide text-areia mb-4">
        QUADRA LIVRE
      </h1>
      <p className="text-areia-muted mb-10 max-w-md">
        Reserve sua quadra de areia — altinha, futevôlei, vôlei ou beach tênis.
      </p>
      <Link
        href="/reservar"
        className="bg-coral hover:bg-coral-hover text-night font-semibold px-8 py-4 rounded-full transition-colors"
      >
        Reservar agora
      </Link>
    </main>
  );
}
