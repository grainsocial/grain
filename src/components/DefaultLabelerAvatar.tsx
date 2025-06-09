type DefaultLabelerAvatarProps = Readonly<{
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  class?: string;
}>;

export function DefaultLabelerAvatar({
  size = 28,
  backgroundColor = "rgb(139 92 246)", // Tailwind purple-500
  foregroundColor = "#fff",
  class: classProp,
}: DefaultLabelerAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      class={classProp}
      aria-hidden="true"
    >
      {/* Square background */}
      <rect
        x="0"
        y="0"
        width="512"
        height="512"
        rx="64"
        fill={backgroundColor}
      />

      {/* Shield icon (perfectly centered) */}
      <g transform="translate(256, 280) scale(0.7) translate(-256, -256)">
        <path
          fill={foregroundColor}
          d="M466.5 83.7 263.1 5.1c-5.9-2.2-12.3-2.2-18.2 0L45.5 83.7C36.6 87 30 95.7 30 105.3c0 198.6 114.6 289.7 221.2 325.7 4.5 1.5 9.3 1.5 13.8 0C367.4 395 482 303.9 482 105.3c0-9.6-6.6-18.3-15.5-21.6z"
        />
      </g>
    </svg>
  );
}
