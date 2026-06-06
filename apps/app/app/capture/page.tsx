import { permanentRedirect } from 'next/navigation';

// /capture is permanently consolidated into /chat per design/v2/design.md §12.1
// "one mic, one surface." Visiting /capture sends the user to /chat with the
// recorder armed (armRecord=1). 308 + replace semantics so back-button from
// /chat does not loop through this route. Locked decision D3 from PR β₁
// /plan-eng-review on 2026-06-06.

export default function Page() {
  permanentRedirect('/chat?armRecord=1');
}
