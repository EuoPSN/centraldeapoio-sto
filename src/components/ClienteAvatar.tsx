import React from "react";

interface ClienteAvatarProps {
  /**
   * Gender of the client. Determines avatar color. Expected values: "masculino", "feminino" or any other string.
   * Defaults to "masculino".
   */
  genero?: string;
  /**
   * Size of the avatar in pixels (width and height). Defaults to 80.
   */
  size?: number;
}

/**
 * Simple generative SVG avatar used in the SimuladorIA UI.
 * It displays a colored circle with a single-letter initial representing the gender.
 * The component is lightweight, has no external dependencies, and works in any React environment.
 */
export const ClienteAvatar: React.FC<ClienteAvatarProps> = ({ genero = "masculino", size = 80 }) => {
  // Choose a background colour based on gender – blue for masculine, pink for feminine, gray fallback.
  const bgColor =
    genero?.toLowerCase() === "feminino"
      ? "#f9a8d4" // pink-300
      : genero?.toLowerCase() === "masculino"
      ? "#93c5fd" // blue-300
      : "#a3a3a3"; // gray fallback

  // Use a single letter as a visual hint. "F" for feminine, "M" otherwise.
  const initial = genero?.toLowerCase() === "feminino" ? "F" : "M";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="rounded-full"
    >
      <circle cx="50" cy="50" r="50" fill={bgColor} />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize="48"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
};

export default ClienteAvatar;
