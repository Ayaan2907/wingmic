/** Text fed to the embedder for canonical event rows (recall #103). */
export function eventEmbedText(event: { name: string; location?: string | null }): string {
  return [event.name, event.location ?? ''].filter(Boolean).join(' · ');
}
