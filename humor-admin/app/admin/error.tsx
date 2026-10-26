'use client';
export default function AdminError({ reset }: { reset: () => void }) {
  return <main className="error-page"><span className="brand-mark">h.</span><h1>We couldn’t load the control room.</h1><p>Your session or the database connection may need a moment. Try again.</p><button className="button primary" onClick={reset}>Try again</button><a href="/login">Back to sign in</a></main>;
}
