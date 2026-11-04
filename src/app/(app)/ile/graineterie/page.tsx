import { redirect } from "next/navigation";

/** La Graineterie est devenue la Serre (0051_ile_serre.sql) : les anciens liens y mènent. */
export default function GraineteriePage() {
  redirect("/ile/serre");
}
