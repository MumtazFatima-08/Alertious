export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g transform="rotate(45 16 16)">
        <ellipse cx="16" cy="8.4" rx="3.4" ry="7.4" fill="#00E5FF" />
      </g>
      <g transform="rotate(135 16 16)">
        <ellipse cx="16" cy="8.4" rx="3.4" ry="7.4" fill="#FF3D9A" />
      </g>
      <g transform="rotate(225 16 16)">
        <ellipse cx="16" cy="8.4" rx="3.4" ry="7.4" fill="#8B5CF6" />
      </g>
      <g transform="rotate(315 16 16)">
        <ellipse cx="16" cy="8.4" rx="3.4" ry="7.4" fill="#FF8A00" />
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#050505" />
    </svg>
  );
}
