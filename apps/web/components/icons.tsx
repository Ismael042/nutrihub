// Ícones de linha minimalistas, feitos à mão (sem dependência externa) — 20x20,
// stroke=currentColor, pra herdar cor do contexto (sidebar clara/escura, texto etc.)
// sem precisar de prop de cor em cada uso.
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="7.5" cy="7" r="2.75" />
      <path d="M2.5 16c0-2.5 2-4.2 5-4.2s5 1.7 5 4.2" />
      <path d="M12.7 3.4c1.2.3 2.1 1.4 2.1 2.7 0 1.3-.9 2.4-2.1 2.7" />
      <path d="M14 11.9c1.8.4 3.5 1.6 3.5 3.9" />
    </Icon>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4" width="15" height="13.5" rx="2" />
      <path d="M2.5 8.5h15" />
      <path d="M6.5 2.5v3M13.5 2.5v3" />
    </Icon>
  );
}

export function IconMapPin(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 18s6-5.3 6-9.8A6 6 0 0 0 4 8.2C4 12.7 10 18 10 18Z" />
      <circle cx="10" cy="8.1" r="2.1" />
    </Icon>
  );
}

export function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="15" height="11" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.6" />
      <rect x="7.2" y="2.2" width="5.6" height="2.6" rx="0.9" />
      <path d="M7 9.5h6M7 12.5h6M7 15h3.5" />
    </Icon>
  );
}

export function IconApple(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12.8 6.2c1.9 0 3.4 1.6 3.4 4 0 3.3-2.2 7.3-4.3 7.3-.9 0-1.3-.6-2-.6s-1.2.6-2.1.6C5.7 17.5 3.4 13.7 3.4 10.4c0-2.6 1.7-4.2 3.5-4.2 1 0 1.8.6 2.4.6s1.5-.7 2.6-.7" />
      <path d="M10.7 5.4c.3-1 1.1-1.8 2.2-2" />
    </Icon>
  );
}

export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 4.2c1.8-.9 4.2-.9 6.5.4 2.3-1.3 4.7-1.3 6.5-.4v11.6c-1.8-.9-4.2-.9-6.5.4-2.3-1.3-4.7-1.3-6.5-.4Z" />
      <path d="M10 4.6v11.6" />
    </Icon>
  );
}

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 5.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v6.5c0 1.1-.9 2-2 2H8.5L5 17v-3H5c-1.1 0-2-.9-2-2Z" />
      <path d="M6.5 7.5h7" />
      <path d="M6.5 10.5h4.5" />
    </Icon>
  );
}

export function IconRepeat(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 9V7a3 3 0 0 1 3-3h9M13.5 1.5 16 4l-2.5 2.5" />
      <path d="M16 11v2a3 3 0 0 1-3 3H4M6.5 18.5 4 16l2.5-2.5" />
    </Icon>
  );
}

export function IconFileText(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5.5 2.5h6l3 3v11.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
      <path d="M11.2 2.5v3.3h3.3" />
      <path d="M7 11h6M7 13.8h6M7 8.3h2.3" />
    </Icon>
  );
}

export function IconPill(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.3" y="9.4" width="13.4" height="6" rx="3" transform="rotate(-38 10 12.4)" />
      <path d="M9.3 8.2 11.9 11" />
    </Icon>
  );
}

export function IconTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.8" />
      <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconFlask(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 2.5h4M8.5 2.5v5.3L4.2 15a1.6 1.6 0 0 0 1.4 2.5h8.8a1.6 1.6 0 0 0 1.4-2.5l-4.3-7.2V2.5" />
      <path d="M6.3 12.3h7.4" />
    </Icon>
  );
}

export function IconStore(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 3.5h14l1.3 4.2a1.9 1.9 0 0 1-3.6 1.2M14.7 8.9a1.9 1.9 0 0 1-3.7 0M11 8.9a1.9 1.9 0 0 1-3.7 0M7.3 8.9a1.9 1.9 0 0 1-3.6-1.2L5 3.5" />
      <path d="M4 9.5V17h12V9.5" />
      <path d="M8 17v-4.5h4V17" />
    </Icon>
  );
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10.3 2.5h5.2v5.2L8.2 15a1.6 1.6 0 0 1-2.3 0l-3-3a1.6 1.6 0 0 1 0-2.3Z" />
      <circle cx="13.4" cy="6.1" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconCheckSquare(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="14" height="14" rx="2.4" />
      <path d="M6.5 10.2 9 12.7l4.5-5.4" />
    </Icon>
  );
}

export function IconTeam(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="6.3" cy="6.5" r="2.4" />
      <circle cx="13.7" cy="6.5" r="2.4" />
      <path d="M2.3 16c0-2.3 1.8-3.9 4-3.9s4 1.6 4 3.9" />
      <path d="M9.7 12.3c2 .1 3.7 1.6 3.7 3.7" />
    </Icon>
  );
}

export function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M2.8 10h14.4M10 2.8c1.9 2 3 4.6 3 7.2s-1.1 5.2-3 7.2c-1.9-2-3-4.6-3-7.2s1.1-5.2 3-7.2Z" />
    </Icon>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </Icon>
  );
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </Icon>
  );
}

export function IconLogOut(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 17.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 4.5 2.5H8" />
      <path d="M13 14l4-4-4-4M7 10h10" />
    </Icon>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4.5 7.5 10 13l5.5-5.5" />
    </Icon>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 2.8c-2.2 0-3.8 1.8-3.8 4v2.4c0 .8-.3 1.6-.9 2.2l-.8.9h11l-.8-.9a3.1 3.1 0 0 1-.9-2.2V6.8c0-2.2-1.6-4-3.8-4Z" />
      <path d="M8.3 16a1.8 1.8 0 0 0 3.4 0" />
    </Icon>
  );
}

export function IconAlertCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6.3v4.4" />
      <circle cx="10" cy="13.4" r="0.15" fill="currentColor" strokeWidth="1.8" />
    </Icon>
  );
}

export function IconCheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.7 10.2 9 12.6l4.3-5" />
    </Icon>
  );
}

export function IconTrendUp(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 13.5 8 8.5l3 3 5.5-6" />
      <path d="M13 5.5h3.5V9" />
    </Icon>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16 16l-3.2-3.2" />
    </Icon>
  );
}

export function IconEye(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M1.5 10c1.8-3.6 5-5.5 8.5-5.5s6.7 1.9 8.5 5.5c-1.8 3.6-5 5.5-8.5 5.5S3.3 13.6 1.5 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </Icon>
  );
}

export function IconEyeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 3.5l15 13" />
      <path d="M8.3 5.1c.55-.13 1.12-.2 1.7-.2 3.5 0 6.7 1.9 8.5 5.5-.6 1.2-1.35 2.24-2.24 3.08M5.4 6.15C3.9 7.1 2.6 8.4 1.5 10c1.02 2.05 2.55 3.6 4.35 4.6.98.55 2.05.9 3.15.9.86 0 1.7-.15 2.5-.44" />
      <path d="M8.15 8.15A2.5 2.5 0 0 0 10 12.5c.55 0 1.06-.17 1.48-.46" />
    </Icon>
  );
}
