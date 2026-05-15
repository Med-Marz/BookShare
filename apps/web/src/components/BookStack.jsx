function BookStack({ className = '' }) {
  return (
    <svg
      viewBox="0 0 320 360"
      role="img"
      aria-label="A stack of decorative books"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bs-bordeaux" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9B3A33" />
          <stop offset="100%" stopColor="#5C2120" />
        </linearGradient>
        <linearGradient id="bs-sepia" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7A6249" />
          <stop offset="100%" stopColor="#3E2F22" />
        </linearGradient>
        <linearGradient id="bs-forest" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3F6B3F" />
          <stop offset="100%" stopColor="#2F4F2F" />
        </linearGradient>
        <linearGradient id="bs-paper" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F3EBDD" />
          <stop offset="100%" stopColor="#E8DDC9" />
        </linearGradient>
      </defs>

      {/* shadow under stack */}
      <ellipse cx="160" cy="338" rx="120" ry="10" fill="rgba(92, 70, 50, 0.18)" />

      {/* bottom book — bordeaux, lying flat */}
      <g>
        <rect x="40" y="270" width="240" height="58" rx="3" fill="url(#bs-bordeaux)" />
        <rect x="40" y="270" width="240" height="6" fill="#7B2D26" />
        <rect x="60" y="288" width="180" height="3" fill="#FAF7F2" opacity="0.18" />
        <rect x="60" y="298" width="120" height="2" fill="#FAF7F2" opacity="0.12" />
        <rect x="280" y="270" width="4" height="58" fill="#3E1414" opacity="0.5" />
      </g>

      {/* middle book — sepia */}
      <g>
        <rect x="60" y="215" width="220" height="56" rx="3" fill="url(#bs-sepia)" />
        <rect x="60" y="215" width="220" height="6" fill="#5C4632" />
        <rect x="78" y="232" width="170" height="3" fill="#FFFCF6" opacity="0.2" />
        <rect x="78" y="242" width="100" height="2" fill="#FFFCF6" opacity="0.14" />
        <rect x="276" y="215" width="4" height="56" fill="#2A1F15" opacity="0.5" />
      </g>

      {/* top book — forest green */}
      <g>
        <rect x="80" y="160" width="200" height="56" rx="3" fill="url(#bs-forest)" />
        <rect x="80" y="160" width="200" height="6" fill="#2F4F2F" />
        <rect x="98" y="178" width="155" height="3" fill="#FAF7F2" opacity="0.22" />
        <rect x="98" y="188" width="90" height="2" fill="#FAF7F2" opacity="0.14" />
        <rect x="276" y="160" width="4" height="56" fill="#1F351F" opacity="0.55" />
      </g>

      {/* leaning book — paper/cream */}
      <g transform="rotate(-14 195 130)">
        <rect x="155" y="60" width="80" height="160" rx="3" fill="url(#bs-paper)" />
        <rect x="155" y="60" width="80" height="6" fill="#E8DDC9" />
        <rect x="161" y="80" width="68" height="2" fill="#7A6249" opacity="0.32" />
        <rect x="161" y="90" width="50" height="2" fill="#7A6249" opacity="0.22" />
        <rect x="161" y="100" width="58" height="2" fill="#7A6249" opacity="0.22" />
        <rect x="231" y="60" width="4" height="160" fill="#C9B998" opacity="0.5" />
      </g>

      {/* ribbon bookmark on top green book */}
      <rect x="240" y="160" width="10" height="74" fill="#B8860B" />
      <polygon points="240,234 250,234 245,244" fill="#B8860B" />
    </svg>
  );
}

export default BookStack;
