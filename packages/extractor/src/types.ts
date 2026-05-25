/**
 * Shared types for the hybrid extractor pipeline.
 *
 * AssemblyAIEntity matches the shape returned by AssemblyAI's `entity_detection`
 * feature: span-level NER over the transcript. `start` and `end` are character
 * offsets into the transcript text.
 *
 * See: https://www.assemblyai.com/docs/audio-intelligence/entity-detection
 */
export interface AssemblyAIEntity {
  entity_type: string;
  text: string;
  start: number;
  end: number;
}
