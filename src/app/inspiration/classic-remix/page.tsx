import InspirationRouteClient from "../InspirationRouteClient";

type ClassicRemixPageProps = {
  searchParams?: {
    cocktail?: string;
  };
};

export default function ClassicRemixPage({ searchParams }: ClassicRemixPageProps) {
  return (
    <InspirationRouteClient
      initialView="classic-remix"
      initialCocktailId={searchParams?.cocktail ?? ""}
    />
  );
}
