import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export const metadata = { title: 'dashboard' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/dashboard');

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: '#FFC452',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          dashboard · placeholder
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
          coming soon.{' '}
          <span className="serif" style={{ fontStyle: 'italic', color: '#FFC452', fontWeight: 400 }}>
            for now, capture + recall.
          </span>
        </h1>
        <p style={{ marginTop: 14, color: 'var(--text-55)', fontSize: 15, lineHeight: 1.55 }}>
          go to <a href="/capture" style={{ color: '#FFC452', textDecoration: 'underline' }}>/capture</a> or <a href="/recall" style={{ color: '#FFC452', textDecoration: 'underline' }}>/recall</a>.
        </p>
      </div>
    </main>
  );
}
