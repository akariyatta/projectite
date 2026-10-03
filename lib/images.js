// Stock photos (Unsplash, free under the Unsplash License — https://unsplash.com/license) used when an item
// has no photo of its own: city covers, and generic pictures for flights / food / activities / transport.
// Safe to import from both server and client components.

const U = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

export const CITY_PHOTOS = {
  Tokyo: U("1513407030348-c983a97b98d8"),
  Osaka: U("1734427842844-29f08e51763a"),
  Bangkok: U("1563492065599-3520f775eeed"),
  "Chiang Mai": U("1512553353614-82a7370096dc"),
  Phuket: U("1601225612316-b4733315a717"),
  Krabi: U("1552465011-b4e21bf6e79a"),
  Pattaya: U("1625492206717-61c584a8b11e"),
  Kyoto: U("1574236170880-fbbca132d83d"),
  Seoul: U("1546874177-9e664107314e"),
  Singapore: U("1496939376851-89342e90adcd"),
  "Hong Kong": U("1536599018102-9f803c140fc1"),
  Taipei: U("1598935898639-81586f7d2129"),
};

export const TYPE_PHOTOS = {
  flight: U("1565444007614-6b38c78224df"),
  food: U("1611143669185-af224c5e3252"),
  activity: U("1600714480856-dc99b28892eb"),
  transport: U("1514337224818-9787cf717f2a"),
  hotel: U("1551882547-ff40c63fe5fa"),
  event: U("1501386761578-eac5c94b800a"),
};

export const cityPhoto = (city) => CITY_PHOTOS[city] ?? TYPE_PHOTOS.activity;

/** Resize an Unsplash URL on the fly (other URLs, e.g. uploads, are returned unchanged). */
export const sized = (url, w) => (url && url.includes("images.unsplash.com") ? url.replace(/([?&])w=\d+/, `$1w=${w}`) : url);
