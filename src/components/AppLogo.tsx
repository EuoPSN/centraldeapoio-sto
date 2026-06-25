import logo from "@/assets/logo.png.asset.json";

interface AppLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

export function AppLogo({ size = "md", className = "" }: AppLogoProps) {
  return (
    <img
      src={logo.url}
      alt="Cartão de Todos"
      className={`${sizes[size]} w-auto ${className}`}
    />
  );
}
