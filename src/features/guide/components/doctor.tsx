/** A friendly doctor, drawn as vector art. The coat carries the Concord symbol. */
export function Doctor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 200"
      role="img"
      aria-label="Illustration of a smiling doctor"
      className={className}
    >
      <path
        d="M22 200V112a88 88 0 0 1 176 0v88z"
        className="fill-primary/20 dark:fill-primary/45"
      />
      <path
        d="M73 96C64 46 88 20 112 20s47 24 39 76c-2 14-7 24-10 30H84c-4-6-9-16-11-30z"
        fill="#2d2530"
      />
      <path d="M96 106h31v30c0 13-31 13-31 0z" fill="#b87b57" />
      <path
        d="M24 200c1-36 22-50 68-64l19.500 20L131 136c46 14 66 28 67 64z"
        fill="#fcfeff"
      />
      <path
        d="M24 200c1-36 22-50 68-64l19.500 20L131 136c46 14 66 28 67 64"
        fill="none"
        stroke="#c9d8df"
        strokeWidth="1.500"
      />
      <path d="M92 135c5 9 34 9 39 0l-9 65h-21z" fill="#0f6b7c" />
      <path d="M97 137l14.500 22L126 137c-6 6-23 6-29 0z" fill="#b87b57" />
      <path
        d="M92 135l-14 6 17 46 9-20zM131 135l14 6-17 46-9-20z"
        fill="#e8f0f4"
        stroke="#c9d8df"
        strokeWidth="1.200"
        strokeLinejoin="round"
      />
      <ellipse cx="80" cy="86" rx="5.500" ry="8" fill="#c08560" />
      <ellipse cx="143" cy="86" rx="5.500" ry="8" fill="#c08560" />
      <path
        d="M81 76c0-26 14-38 30.500-38S142 50 142 76c0 26-13 45-30.500 45S81 102 81 76z"
        fill="#cf946c"
      />
      <path
        d="M78 82c-3-30 12-47 34-47s36 17 33 47c-3-9-6-16-11-23-4 3-9 4-14 3 1-2 2-4 2-6-9 9-28 8-36 10-4 4-6 9-8 16z"
        fill="#2d2530"
      />
      <path
        d="M90 74q8-5 15-1M118 73q8-4 15 1"
        fill="none"
        stroke="#2d2530"
        strokeWidth="2.400"
        strokeLinecap="round"
      />
      <circle cx="98" cy="84" r="3" fill="#2d2530" />
      <circle cx="125" cy="84" r="3" fill="#2d2530" />
      <g fill="none" stroke="#0b4c59" strokeWidth="2">
        <rect x="86.500" y="75.500" width="22" height="17" rx="8" />
        <rect x="114.500" y="75.500" width="22" height="17" rx="8" />
        <path d="M108.500 82q3-2 6 0M86.500 82l-6-2M136.500 82l6-2" />
      </g>
      <path
        d="M111 88q-4 9 1.500 10"
        fill="none"
        stroke="#a86c49"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M100 103.500q11.500 3 23 0c-1.500 9.500-21.500 9.500-23 0z"
        fill="#fff"
        stroke="#8f4f3c"
        strokeWidth="1.600"
        strokeLinejoin="round"
      />
      <ellipse cx="91" cy="99" rx="5" ry="3" fill="#e08c72" opacity=".45" />
      <ellipse cx="132" cy="99" rx="5" ry="3" fill="#e08c72" opacity=".45" />
      <g fill="none" stroke="#12323c" strokeWidth="3.600" strokeLinecap="round">
        <path d="M87 137c-5 22-3 36 3 49" />
        <path d="M136 137c6 16 10 22 10 34" />
      </g>
      <circle cx="146" cy="180" r="9" fill="#12323c" />
      <circle cx="146" cy="180" r="4.500" fill="#8fb6c0" />
      <circle cx="90" cy="188" r="3.500" fill="#12323c" />
      <g
        transform="translate(46 164) scale(.235)"
        fill="none"
        stroke="#0f6b7c"
        strokeWidth="13"
        strokeLinecap="round"
      >
        <path d="M51 36C47 30 41 27 34.500 27 24.500 27 19 35.500 19 46c0 17 14 34 32 54" />
        <path
          transform="translate(128 0) scale(-1 1)"
          d="M51 36C47 30 41 27 34.500 27 24.500 27 19 35.500 19 46c0 17 14 34 32 54"
        />
      </g>
    </svg>
  )
}
