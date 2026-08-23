import InspirationRouteClient from "../InspirationRouteClient";

type ClassicRemixPageProps = {
  searchParams?: Promise<{
    cocktail?: string;
  }>;
};

export default async function ClassicRemixPage({ searchParams }: ClassicRemixPageProps) {
  const params = await searchParams;
  return (
    <InspirationRouteClient
      initialView="classic-remix"
      initialCocktailId={params?.cocktail ?? ""}
    />
  );
}
