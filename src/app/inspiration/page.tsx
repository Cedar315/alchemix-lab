import InspirationRouteClient from "./InspirationRouteClient";

type InspirationPageProps = {
  searchParams?: {
    tab?: string;
  };
};

export default function InspirationPage({ searchParams }: InspirationPageProps) {
  return <InspirationRouteClient initialView="menu" initialExploreTab={searchParams?.tab === "classic" ? "classic" : "convenience"} />;
}
