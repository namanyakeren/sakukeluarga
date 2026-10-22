import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 10.6 12 3.5l9 7.1" />
    <path d="M5.5 9.4V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.4" />
  </Base>
);

export const IconList = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconChart = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
);

export const IconWallet = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1H5.5A2.5 2.5 0 0 0 3 10.5v7A2.5 2.5 0 0 0 5.5 20H20V8" />
    <path d="M16 13.5h2.5" />
  </Base>
);

export const IconTag = (props: IconProps) => (
  <Base {...props}>
    <path d="M20.6 13.6 13.4 20.8a2 2 0 0 1-2.8 0l-7.4-7.4V4h9.4l8 8a1.7 1.7 0 0 1 0 1.6Z" />
    <circle cx="8" cy="8" r="1.3" />
  </Base>
);

export const IconSettings = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h8M16 18h4" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="14" cy="18" r="2" />
  </Base>
);

export const IconPlus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconClose = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconTrash = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6.5 7l.8 12.1A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9L17.5 7" />
    <path d="M10 11v6M14 11v6" />
  </Base>
);

export const IconEdit = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </Base>
);

export const IconDownload = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />
  </Base>
);

export const IconLogout = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Base>
);

export const IconSearch = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Base>
);

export const IconArrowUp = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Base>
);

export const IconArrowDown = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
);

export const IconSwap = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </Base>
);

export const IconChat = (props: IconProps) => (
  <Base {...props}>
    <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.8-.3-4-.9L4 21l1.4-4.2A8.5 8.5 0 1 1 21 12Z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.4} />
  </Base>
);

export const IconCheck = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const IconRefresh = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 4v7h-7" />
  </Base>
);

export const IconUsers = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.4A5.5 5.5 0 0 1 21 20" />
  </Base>
);

export const IconLock = (props: IconProps) => (
  <Base {...props}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </Base>
);
