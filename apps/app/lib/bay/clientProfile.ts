// apps/app/lib/bay/clientProfile.ts — the browser-held throwaway profile's
// shape, shared by the bay router (server validation) and the /bay surface
// (client-side validation before an input ever rides a request). Locked
// decision 3: nothing is stored server-side before claim — the browser holds
// the profile and sends it exclusively as score/ask/claim inputs.

import { z } from 'zod';

const httpsLink = z
  .string()
  .max(300)
  .refine((v) => /^https:\/\//.test(v), 'links must be https');

export const clientProfileSchema = z
  .object({
    /** raw pasted text — rides into retrieval as-is and parses for fields */
    text: z.string().max(4000).optional(),
    name: z.string().max(120).optional(),
    headline: z.string().max(200).optional(),
    roles: z.array(z.string().max(80)).max(12).optional(),
    topics: z.array(z.string().max(80)).max(24).optional(),
    goals: z.array(z.string().max(120)).max(12).optional(),
    links: z
      .object({
        linkedin: httpsLink,
        github: httpsLink,
        x: httpsLink,
        site: httpsLink,
      })
      .partial()
      .optional(),
  })
  .refine(
    (v) =>
      Boolean(
        (v.text && v.text.trim()) ||
          v.name ||
          v.headline ||
          v.roles?.length ||
          v.topics?.length ||
          v.goals?.length ||
          (v.links && Object.keys(v.links).length),
      ),
    { message: 'a client profile needs something to read — paste a few lines or fill a field' },
  );

export type ClientProfile = z.infer<typeof clientProfileSchema>;
