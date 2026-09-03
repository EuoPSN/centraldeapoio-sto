import logoFull from "@/assets/logo.png.asset.json";


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
  // useSidebar só funciona dentro do SidebarProvider (não existe na tela de login,
  // por exemplo) — nesses casos, sempre mostramos a logo completa.
  let collapsed = false;
  try {
    const { state } = useSidebar();
    collapsed = state === "collapsed";
  } catch {
    collapsed = false;
  }

  const src = logoFull.url;

  return (
    <img
      src={src}
      alt="Cartão de Todos"
      className={`${sizes[size]} w-auto ${className}`}
    />
  );
}
