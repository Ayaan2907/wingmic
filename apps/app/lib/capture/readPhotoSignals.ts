import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { env } from '@/lib/config/env';
import { normalizePhotoSignals, type PhotoSignals } from './photoSignals';

const PhotoSignalsSchema = z.object({
  personName: z.string().nullable(),
  companyName: z.string().nullable(),
  eventName: z.string().nullable(),
  linkedin: z.string().nullable(),
  eventUrl: z.string().nullable(),
});

const EMPTY: PhotoSignals = normalizePhotoSignals({});
const VISION_TIMEOUT_MS = 8_000;

/**
 * Read a badge / poster / QR for a few graph signals. No-ops without a key.
 * Never dumps poster body copy into the transcript — names and URLs only.
 * Never fetch LinkedIn HTML — we only return URLs the model can see.
 */
export async function readPhotoSignals(jpegBase64: string): Promise<PhotoSignals> {
  if (!env.OPENROUTER_API_KEY || jpegBase64.length < 32) return EMPTY;
  const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  const model = openrouter(env.EXTRACTION_MODEL);
  try {
    const vision = generateObject({
      model,
      schema: PhotoSignalsSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'This is a networking photo (badge, poster, screenshot, or QR).',
                'Return only primary signals, not a transcript of the image.',
                'personName: the one person this photo is about. Null if many names or none.',
                'companyName: that person\'s company. Not a sponsor list.',
                'eventName: the event title only. One short title. Null if none.',
                'linkedin: a LinkedIn /in/ URL if shown or encoded in a QR.',
                'eventUrl: a Luma, Partiful, or Google Calendar event URL if shown.',
                'Do not return slogans, prices, dates-as-prose, sponsor lists, or body copy.',
                'If a field is absent or unsure, return null. Do not invent URLs.',
              ].join(' '),
            },
            { type: 'image', image: Buffer.from(jpegBase64, 'base64') },
          ],
        },
      ],
      temperature: 0,
    });
    const { object } = await Promise.race([
      vision,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('vision timeout')), VISION_TIMEOUT_MS);
      }),
    ]);
    return normalizePhotoSignals(object);
  } catch {
    return EMPTY;
  }
}
