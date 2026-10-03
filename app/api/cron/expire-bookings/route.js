import { expireStaleBookings } from "@/lib/booking-flow";

// Cancels unpaid bookings past their deadline. Pages already do this lazily (at most once a minute);
// on a real server also call this every few minutes from a scheduler:
//   GET /api/cron/expire-bookings   with header  Authorization: Bearer <CRON_SECRET>
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const expired = await expireStaleBookings({ force: true });
  return Response.json({ expired });
}
