interface OpenReplyLogoProps {
  className?: string;
  size?: number;
}

export default function OpenReplyLogo({
  className = "h-6 w-6",
  size,
}: OpenReplyLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#18181b" />
      <path
        d="M10 8.5H22C24.4853 8.5 26.5 10.5147 26.5 13V18C26.5 20.4853 24.4853 22.5 22 22.5H16L11.5 26V22.5H10C7.51472 22.5 5.5 20.4853 5.5 18V13C5.5 10.5147 7.51472 8.5 10 8.5Z"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5H20M17 12.5L20 15.5L17 18.5"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
