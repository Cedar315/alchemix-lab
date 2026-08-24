import AdminConsoleClient from "./AdminConsoleClient";
import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError, requireAdmin } from "@/lib/auth/current-user";

export const metadata = {
  title: "AlcheMix Console",
};

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/?auth=required");
    if (error instanceof AuthorizationError) redirect("/?auth=forbidden");
    throw error;
  }
  return <AdminConsoleClient />;
}
