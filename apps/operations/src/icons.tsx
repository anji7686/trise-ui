import type { SVGProps } from 'react';

type IconName = 'activity' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'bell' | 'building' | 'calendar' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'clipboard' | 'download' | 'eye' | 'filter' | 'grid' | 'map-pin' | 'pencil' | 'plus' | 'save' | 'search' | 'send' | 'settings' | 'shield' | 'upload' | 'users' | 'x';

const paths: Record<IconName, string> = {
  activity: 'M3 12h4l2-8 4 16 2-8h6',
  'arrow-down': 'M12 5v14m0 0 7-7m-7 7-7-7',
  'arrow-left': 'M19 12H5m7 7-7-7 7-7',
  'arrow-right': 'M5 12h14m0 0-7-7m7 7-7 7',
  'arrow-up': 'M12 19V5m0 0-7 7m7-7 7 7',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  building: 'M4 21V5l8-3 8 3v16M8 9h1m6 0h1M8 13h1m6 0h1M8 17h1m6 0h1M10 21v-3h4v3',
  calendar: 'M5 4h14v16H5zM8 2v4m8-4v4M5 9h14',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  clipboard: 'M8 4h8v3H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M5 20h14',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  filter: 'M4 5h16l-6 7v5l-4 2v-7L4 5Z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  'map-pin': 'M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  pencil: 'm4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-12 3 3',
  plus: 'M12 5v14M5 12h14',
  save: 'M5 4h12l2 2v14H5V4Zm3 0v5h7V4M8 20v-7h8v7',
  search: 'm21 21-4.4-4.4m0 0A7 7 0 1 0 6.7 6.7a7 7 0 0 0 9.9 9.9Z',
  send: 'm3 11 18-8-8 18-2-7-8-3Zm8 3 4-5',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0-0-8Zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  shield: 'M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z',
  upload: 'M12 16V4m0 0-5 5m5-5 5 5M5 14v6h14v-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7a4 4 0 0 1 0 7.7M22 21v-2a4 4 0 0 0-3-3.9',
  x: 'm6 6 12 12M18 6 6 18'
};

export function SvgIcon({ name, label, size = 16, ...props }: { name: IconName; label?: string; size?: number } & Omit<SVGProps<SVGSVGElement>, 'aria-label'>) {
  const className = ['trise-icon', props.className].filter(Boolean).join(' ');
  return <svg {...props} className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" aria-hidden={label ? undefined : true} aria-label={label}><path d={paths[name]} /></svg>;
}
