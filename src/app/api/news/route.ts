import { NextResponse } from "next/server";
import { getDailyGoodNews } from "@/lib/news";

/** Bonnes nouvelles du jour (publiques), utile pour vérifier les flux. */
export async function GET() {
  const items = await getDailyGoodNews();
  return NextResponse.json({ count: items.length, items });
}
