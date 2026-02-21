import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Caicos Pool Service</h1>
      <Link
        href="/login"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Log in
      </Link>
    </main>
  );
}
