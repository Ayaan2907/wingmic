import { permanentRedirect } from 'next/navigation';

// /capture is permanently consolidated into /chat per design/v2/design.md §12.1
// "one mic, one surface." PR β₁-D pivot: the orb in the bottom nav is the
// dock — recording happens in place on whatever page the user is on, and
// the commit pipeline routes to /chat after completion. Visiting /capture
// directly just sends the user to /chat (no armRecord param — that URL-
// param approach was rolled back in β₁-D).

export default function Page() {
  permanentRedirect('/chat');
}
