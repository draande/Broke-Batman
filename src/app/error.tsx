"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>The Batcomputer needs a moment.</h1>
      <p>Something went wrong while loading this page.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
