import InspirationRouteClient from "../InspirationRouteClient";

type ConvenienceMixPageProps = {
  searchParams?: {
    cocktail?: string;
  };
};

export default function ConvenienceMixPage({ searchParams }: ConvenienceMixPageProps) {
  return (
    <InspirationRouteClient
      initialView="convenience-mix"
      initialCocktailId={searchParams?.cocktail ?? ""}
    />
  );
}
