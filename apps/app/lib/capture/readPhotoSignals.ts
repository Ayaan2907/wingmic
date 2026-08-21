import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { env } from '@/lib/config/env';
import { type PhotoSignals } from './photoSignals';

const PhotoSignalsSchema = z.object({
  visibleText: z.string().nullable(),
  linkedin: z.string().nullable(),
  eventUrl: z.string().nullable(),
});

const EMPTY: PhotoSignals = { visibleText: null, linkedin: null, eventUrl: null };
const VISION_TIMEOUT_MS = 8_000;

/**
 * Read QR / badge text / public URLs from a JPEG. No-ops without a key.
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
                'Read this networking photo.',
                'Return visible names/text, a LinkedIn /in/ URL if shown or encoded in a QR, and a Luma/Partiful/Google Calendar event URL if shown.',
                'If a field is absent, return null. Do not invent URLs.',
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
    return {
      visibleText: object.visibleText?.trim() || null,
      linkedin: object.linkedin?.trim() || null,
      eventUrl: object.eventUrl?.trim() || null,
    };
  } catch {
    return EMPTY;
  }
}
