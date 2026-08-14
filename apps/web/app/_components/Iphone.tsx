// @ts-nocheck
/* eslint-disable @next/next/no-img-element */
// iPhone frame SVG vendored from Magic UI (magicui.design) — MIT licensed.
// Geometry is kept 1:1; fills are recolored for wingmic's dark theme (silver
// titanium body, black Dynamic Island so it reads over the live video). The
// screen is punched transparent so a <video> placed behind it shows through.

const PHONE_W = 433;
const PHONE_H = 882;
const SCREEN_X = 21.25;
const SCREEN_Y = 19.25;
const SCREEN_W = 389.5;
const SCREEN_H = 843.5;
const SCREEN_R = 55.75;

const BODY = '#d8d8de';
const EDGE = '#c4c4cc';
const ISLAND = '#08080c';
const LENS = '#1c1c24';

// Screen-area geometry as percentages of the frame — use these to position
// media/controls into the screen so they line up with the punched hole.
export const IPHONE_ASPECT = `${PHONE_W}/${PHONE_H}`;
export const screenBox = {
  left: `${(SCREEN_X / PHONE_W) * 100}%`,
  top: `${(SCREEN_Y / PHONE_H) * 100}%`,
  width: `${(SCREEN_W / PHONE_W) * 100}%`,
  height: `${(SCREEN_H / PHONE_H) * 100}%`,
  borderRadius: `${(SCREEN_R / SCREEN_W) * 100}% / ${(SCREEN_R / SCREEN_H) * 100}%`,
};

export function IphoneFrame({ style, maskId = 'wm-screen-punch' }) {
  return (
    <svg
      viewBox={`0 0 ${PHONE_W} ${PHONE_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}
    >
      <g mask={`url(#${maskId})`}>
        <path d="M2 73C2 32.6832 34.6832 0 75 0H357C397.317 0 430 32.6832 430 73V809C430 849.317 397.317 882 357 882H75C34.6832 882 2 849.317 2 809V73Z" fill={BODY} />
        <path d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z" fill={EDGE} />
        <path d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z" fill={EDGE} />
        <path d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z" fill={EDGE} />
        <path d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z" fill={EDGE} />
        <path d="M6 74C6 35.3401 37.3401 4 76 4H356C394.66 4 426 35.3401 426 74V808C426 846.66 394.66 878 356 878H76C37.3401 878 6 846.66 6 808V74Z" fill="#050509" />
      </g>

      {/* earpiece slit */}
      <path opacity="0.35" d="M174 5H258V5.5C258 6.60457 257.105 7.5 256 7.5H176C174.895 7.5 174 6.60457 174 5.5V5Z" fill={EDGE} />

      {/* screen inner ring */}
      <path
        d={`M${SCREEN_X} 75C${SCREEN_X} 44.2101 46.2101 ${SCREEN_Y} 77 ${SCREEN_Y}H355C385.79 ${SCREEN_Y} 410.75 44.2101 410.75 75V807C410.75 837.79 385.79 862.75 355 862.75H77C46.2101 862.75 ${SCREEN_X} 837.79 ${SCREEN_X} 807V75Z`}
        fill={BODY}
        stroke={BODY}
        strokeWidth="0.5"
        mask={`url(#${maskId})`}
      />

      {/* Dynamic Island */}
      <path d="M154 48.5C154 38.2827 162.283 30 172.5 30H259.5C269.717 30 278 38.2827 278 48.5C278 58.7173 269.717 67 259.5 67H172.5C162.283 67 154 58.7173 154 48.5Z" fill={ISLAND} />
      <path d="M249 48.5C249 42.701 253.701 38 259.5 38C265.299 38 270 42.701 270 48.5C270 54.299 265.299 59 259.5 59C253.701 59 249 54.299 249 48.5Z" fill={ISLAND} />
      <path d="M254 48.5C254 45.4624 256.462 43 259.5 43C262.538 43 265 45.4624 265 48.5C265 51.5376 262.538 54 259.5 54C256.462 54 254 51.5376 254 48.5Z" fill={LENS} />

      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width={PHONE_W} height={PHONE_H} fill="white" />
          <rect x={SCREEN_X} y={SCREEN_Y} width={SCREEN_W} height={SCREEN_H} rx={SCREEN_R} ry={SCREEN_R} fill="black" />
        </mask>
      </defs>
    </svg>
  );
}
