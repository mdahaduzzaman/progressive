import { headers } from "next/headers";
import { tenantFromHost } from "@/lib/tenants.mjs";
import { TodoApp } from "./TodoApp";

export default async function Page() {
  const t = tenantFromHost((await headers()).get("host"));
  return <TodoApp tenantSlug={t.slug} tenantName={t.name} tenantShortName={t.shortName} />;
}
