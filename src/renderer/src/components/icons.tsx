import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props
  }
}

export function IconDownload(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export function IconFolder(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

export function IconImage(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

export function IconPlay(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7Z" />
    </svg>
  )
}

export function IconPause(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function IconX(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function IconChevronLeft(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function IconChevronRight(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function IconRefresh(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function IconExternal(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  )
}

export function IconCheck(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

export function IconAlert(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

export function IconSpinner(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)} className={`animate-spin ${props.className ?? ''}`}>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  )
}

export function IconVideo(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </svg>
  )
}

export function IconGrid(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function IconSettings(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function IconReddit(props: IconProps): React.JSX.Element {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M22 11.8a2.2 2.2 0 0 0-3.7-1.6 10.9 10.9 0 0 0-5.4-1.7l.9-4.3 3 .6a1.6 1.6 0 1 0 .2-1.1l-3.5-.7a.6.6 0 0 0-.7.5l-1 4.9a10.9 10.9 0 0 0-5.5 1.7A2.2 2.2 0 1 0 3.4 14a4.3 4.3 0 0 0-.1.9c0 3.4 4 6.2 8.7 6.2s8.7-2.8 8.7-6.2a4.3 4.3 0 0 0-.1-.9 2.2 2.2 0 0 0 1.4-2.2ZM7.5 13.9a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm8.2 4.1a5.6 5.6 0 0 1-3.7 1.1 5.6 5.6 0 0 1-3.7-1.1.5.5 0 1 1 .7-.7 4.7 4.7 0 0 0 3 .9 4.7 4.7 0 0 0 3-.9.5.5 0 1 1 .7.7Zm-.2-2.6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  )
}
