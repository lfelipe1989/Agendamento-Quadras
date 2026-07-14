import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
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
