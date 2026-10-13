import Image from "next/image";
import { getCocktailIllustration } from "../lib/data/cocktail-illustrations";
import CocktailLineArt from "./CocktailLineArt";

export default function CocktailIllustration({ id, name, className = "", sizes = "(max-width: 640px) 50vw, 320px" }: {
  id: string;
  name: string;
  className?: string;
  sizes?: string;
}) {
  const src = getCocktailIllustration(id);
  if (!src) return <CocktailLineArt name={name} className={className} />;
  return <Image src={src} alt={`${name}，手绘酒款插画`} width={1024} height={1024}
    sizes={sizes}
    className={`cocktail-illustration ${className}`} style={{ objectFit: "contain", backgroundColor: "#fff" }} />;
}
