import { Play } from 'lucide-react'
import { useState } from 'react'

/**
 * Click-to-load YouTube player. Nothing is requested from YouTube until the person
 * presses play (privacy and page speed); it then loads from youtube-nocookie.com, which
 * avoids tracking cookies until the video plays.
 */
export function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={`Video: ${title}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="aspect-video w-full rounded-lg border border-border"
      />
    )
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-band p-6 text-center">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Play className="size-4 fill-current" aria-hidden /> Play video
      </button>
      <p className="max-w-sm text-xs text-ink-muted">
        Plays from YouTube. Nothing loads from YouTube until you press play.
      </p>
    </div>
  )
}
