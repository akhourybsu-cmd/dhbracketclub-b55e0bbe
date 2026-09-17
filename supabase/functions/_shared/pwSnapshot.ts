// Records today's portfolio value on the equity curve right after a fill, so the
// curve moves as soon as someone trades instead of waiting for the nightly close.
import { etDate } from "./pwMarket.ts";

export async function stampEquityPoint(
  admin: { from: (t: string) => any },
  portfolioId: string,
) {
  try {
    const { data } = await admin.from("pw_portfolios")
      .select("id, club_id, total_value").eq("id", portfolioId).maybeSingle();
    if (!data) return;
    await admin.from("pw_daily_values").upsert(
      {
        portfolio_id: data.id,
        club_id: data.club_id,
        trading_date: etDate(),
        value: data.total_value,
      },
      { onConflict: "portfolio_id,trading_date" },
    );
  } catch {
    /* the curve is a read-model; never fail a fill over it */
  }
}
