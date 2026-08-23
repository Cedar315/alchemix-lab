import InspirationRouteClient from "../InspirationRouteClient";

type ConvenienceMixPageProps = {
  searchParams?: Promise<{
    cocktail?: string;
  }>;
};

export default async function ConvenienceMixPage({ searchParams }: ConvenienceMixPageProps) {
  const params = await searchParams;
  return (
    <InspirationRouteClient
      initialView="convenience-mix"
      initialCocktailId={params?.cocktail ?? ""}
    />
  );
}
