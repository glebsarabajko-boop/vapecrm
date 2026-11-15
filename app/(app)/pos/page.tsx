import { requireUser } from "@/lib/auth";
import PosClient from "./PosClient";

export default async function PosPage() {
  await requireUser();
  return <PosClient />;
}
