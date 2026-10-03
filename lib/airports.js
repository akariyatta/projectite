// Flights store airport codes; map them to the city names used by hotels/events.
// Kept separate from lib/planner.js so the public site doesn't load the AI SDK just for this table.
const AIRPORT_CITY = {
  BKK: "Bangkok", DMK: "Bangkok", CNX: "Chiang Mai", HKT: "Phuket",
  NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", ITM: "Osaka",
  ICN: "Seoul", GMP: "Seoul", SIN: "Singapore", HKG: "Hong Kong", TPE: "Taipei",
  KBV: "Krabi", UTP: "Pattaya",
};

export const airportCity = (code) => AIRPORT_CITY[code] ?? code;
