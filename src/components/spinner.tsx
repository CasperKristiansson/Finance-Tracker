import React from "react";

interface OvalProperties {
  color?: string;
  height?: number;
  width?: number;
  ariaLabel?: string;
  duration?: number;
}

export const Spinner: React.FC<OvalProperties> = ({
  color = "#000000",
  height = 80,
  width = 80,
  ariaLabel = "oval-loading",
  duration = 2,
}) => {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className="flex items-center justify-center"
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 38 38"
        stroke={color}
        className="animate-spin"
      >
        <g fill="none" fillRule="evenodd">
          <g transform="translate(1 1)" strokeWidth="2">
            <circle strokeOpacity=".5" cx="18" cy="18" r="18" />
            <path d="M36 18c0-9.94-8.06-18-18-18">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 18 18"
                to="360 18 18"
                dur={`${duration}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        </g>
      </svg>
    </div>
  );
};
