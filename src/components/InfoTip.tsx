import { useId, useState } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [pinned, setPinned] = useState(false)
  const tipId = useId()

  return (
    <span className="relative ml-1 inline-flex shrink-0 align-middle">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-500/80 text-[10px] font-semibold leading-none text-slate-400 transition-colors hover:border-amber-500/60 hover:text-amber-300/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500/70"
        aria-label="What does this setting do?"
        title={text}
        aria-expanded={pinned}
        aria-describedby={pinned ? tipId : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPinned((open) => !open)
        }}
        onBlur={() => setPinned(false)}
      >
        i
      </button>
      {pinned ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute right-0 top-[calc(100%+4px)] z-40 w-[min(15rem,calc(100vw-3rem))] rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-slate-200 shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
