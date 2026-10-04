import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page">
      <h1>Case not found.</h1>
      <p>This corner of Gotham doesn&apos;t exist.</p>
      <Link className="button" href="/app">
        Return to mission control
      </Link>
    </main>
  );
}
