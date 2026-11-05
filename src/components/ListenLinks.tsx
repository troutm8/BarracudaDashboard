import type { GameView } from "@/lib/views";

/** Where to follow a game: FloHockey video, and the audio stream of whichever side we care about. */
export function ListenLinks({ g, featuredId }: { g: GameView; featuredId?: number }) {
  const audio = g.away.id === featuredId ? g.awayAudioUrl ?? g.homeAudioUrl : g.homeAudioUrl ?? g.awayAudioUrl;
  if (!g.videoUrl && !audio) return null;
  return (
    <span className="inline-flex gap-2 text-[11px]">
      {g.videoUrl && (
        <a href={g.videoUrl} className="text-teal hover:underline" target="_blank" rel="noreferrer">
          Watch
        </a>
      )}
      {audio && (
        <a href={audio} className="text-teal hover:underline" target="_blank" rel="noreferrer">
          Listen
        </a>
      )}
    </span>
  );
}
