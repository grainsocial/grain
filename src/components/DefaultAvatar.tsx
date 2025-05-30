type DefaultAvatarProps = Readonly<{
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  class?: string;
}>;

export function DefaultAvatar({
  size = 28,
  backgroundColor = "#00a6f4", // Tailwind sky 500
  foregroundColor = "#fff",
  class: classProp,
}: DefaultAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      class={classProp}
      aria-hidden="true"
    >
      {/* Circle background */}
      <circle cx="256" cy="256" r="256" fill={backgroundColor} />

      {/* User icon (similar to Font Awesome's user icon) */}
      <g transform="translate(128, 96)">
        <path
          fill={foregroundColor}
          d="M128 128c35.3 0 64-28.7 64-64s-28.7-64-64-64S64 28.7 64 64s28.7 64 64 64zm-44.1 32C37.5 160 0 197.5 0 244.1v39.7c0 8.8 7.2 16 16 16h224c8.8 0 16-7.2 16-16v-39.7c0-46.6-37.5-84.1-83.9-84.1h-88.2z"
        />
      </g>
    </svg>
  );
}
