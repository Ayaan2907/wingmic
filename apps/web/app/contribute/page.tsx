import type { Metadata } from 'next';
import ContributeClient from './ContributeClient';

export const metadata: Metadata = {
  title: 'contribute',
  description:
    'Build wingmic with us. Live GitHub issues and PRs, the version roadmap, and where we post along the way. Open source, MIT, issue-first.',
  alternates: { canonical: 'https://wingmic.xyz/contribute' },
};

export default function Page() {
  return <ContributeClient />;
}
