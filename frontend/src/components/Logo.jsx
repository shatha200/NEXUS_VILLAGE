import React from "react";

// Hexagon = a cell of the village grid. Leaves = agriculture. Gold sun = energy.
// Roots split into circuit traces = water and power networks under the land.
export default function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Nexus logo">
      <path d="M32 3 L58 18 V46 L32 61 L6 46 V18 Z" stroke="#E6E9E2" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 22 V44" stroke="#E6E9E2" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 36 C22 36 18 30 18 24 C26 24 32 28 32 36Z" fill="#4FA85F" />
      <path d="M32 31 C42 31 46 25 46 19 C38 19 32 23 32 31Z" fill="#4FA85F" />
      <circle cx="32" cy="15" r="3.5" fill="#E8A317" />
      <path d="M32 44 V48 M32 45 H22 V48 M32 45 H42 V48" stroke="#E6E9E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="50" r="1.8" fill="#E8A317" />
      <circle cx="32" cy="50" r="1.8" fill="#5A9FC9" />
      <circle cx="42" cy="50" r="1.8" fill="#E8A317" />
    </svg>
  );
}
