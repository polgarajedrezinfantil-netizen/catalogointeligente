import { redirect } from "next/navigation";

// El dashboard ahora vive fusionado en el Inicio (/admin).
export default function DashboardPage() {
  redirect("/admin");
}
