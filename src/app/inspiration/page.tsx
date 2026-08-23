import InspirationRouteClient from "./InspirationRouteClient";

type InspirationPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function InspirationPage({ searchParams }: InspirationPageProps) {
  const params = await searchParams;
  return <InspirationRouteClient initialView="menu" initialExploreTab={params?.tab === "classic" ? "classic" : "convenience"} />;
}
