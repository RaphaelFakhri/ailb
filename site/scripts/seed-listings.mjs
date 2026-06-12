// Reseed the product, service, and gig listings in the LISTINGS KV namespace.
// Emits two files for wrangler bulk ops, then prints the commands to run:
//   scripts/kv-bulk-put.json    — l:<id> entries + idx:<type>
//   scripts/kv-bulk-delete.json — stale keys from previous seeds
//
//   node scripts/seed-listings.mjs
//   npx wrangler kv bulk delete scripts/kv-bulk-delete.json --namespace-id=<id> --force
//   npx wrangler kv bulk put scripts/kv-bulk-put.json --namespace-id=<id>
//
// Ids are stable slugs so reseeding overwrites instead of duplicating.
// Photos live at /images/{things,services,gigs}/<slug>/{1,2,3}.webp in site/public
// (720px max edge, WebP q72 — keep new photos in that envelope).

import { writeFileSync } from "node:fs";

const BASE_TS = 1781293000000; // fixed base so reseeds are deterministic

const things = [
  ["kia-picanto", "2017 Kia Picanto automatic", "$6,700", "Furn el Chebbak", "Karim",
    "92,000 km, automatic, clean interior, small rear-bumper scratch, moteur/vitesse good.",
    ["car", "automatic", "verified"]],
  ["samsung-fridge", "Samsung fridge 420L", "$180", "Jal el Dib", "Rita",
    "Working Samsung fridge, clean cooling, small door scratch, buyer handles pickup.",
    ["appliance", "home"]],
  ["iphone-13-pro", "iPhone 13 Pro 128GB, clean IMEI", "$450", "Achrafieh", "Omar",
    "Battery 88%, Face ID working, iCloud removed in front of buyer, screen history to verify in Settings.",
    ["phone", "apple", "verified"]],
  ["kia-cerato", "2014 Kia Cerato — 96k km", "$6,800", "Hazmieh", "Joe",
    "One owner, mécanique paid till 2027, recent brake pads, no accidents per agent inspection checklist.",
    ["car", "sedan"]],
  ["iphone-12", "iPhone 12, 128GB", "$310", "Hamra", "Sara",
    "Battery 84%, blue, always in a case — box and cable included, IMEI checked clean.",
    ["phone", "apple"]],
  ["l-couch", "L-shape couch, grey", "$220", "Dbayeh", "Maya",
    "2.8m corner sofa, washable covers, no stains, from a pet-free home. You arrange the van.",
    ["furniture", "home"]],
  ["ps5", "PS5 + 2 controllers", "$380", "Antelias", "Marc",
    "Disc edition, quiet, with two DualSense controllers and FC25 disc. Serial verified not stolen.",
    ["gaming", "console"]],
  ["macbook-air-m1", "MacBook Air M1, 8/256", "$520", "Badaro", "Nour",
    "Battery cycle count 210, no dents, charger included. Activation lock removed in front of buyer.",
    ["laptop", "apple", "verified"]],
  ["vespa", "Vespa Primavera 2019", "$2,900", "Jounieh", "Tony",
    "11,400 km, serviced at the dealer, two keys, papers ready for transfer — agent has the stamp order.",
    ["scooter", "verified"]],
  ["dining-table", "Dining table + 6 chairs", "$180", "Baabda", "Georges",
    "Solid wood, seats six, two chairs reupholstered last year. Minor surface marks, photos show all.",
    ["furniture", "home"]],
  ["canon-250d", "Canon EOS 250D + 50mm", "$410", "Hamra", "Lea",
    "Shutter count 18k, with 50mm f/1.8, two batteries and a 64GB card. Sample shots on request.",
    ["camera", "photography"]],
  ["lg-washer", "LG 8kg front-load washer", "$240", "Zalka", "Elie",
    "Direct drive, 2022 model, moves out end of month — works on generator power without tripping.",
    ["appliance", "home"]],
  ["gaming-pc", "Gaming PC — RTX 3060, Ryzen 5", "$650", "Jdeideh", "Charbel",
    "Ryzen 5 5600, RTX 3060 12GB, 16GB RAM, 1TB NVMe. Benchmarks in the photos, runs cool.",
    ["gaming", "pc"]],
  ["road-bike", "Road bike 54cm, carbon fork", "$390", "Batroun", "Wissam",
    "Aluminium frame, Shimano 105 groupset, new tires. Fits 170–180cm. Test rides welcome.",
    ["bike", "sport"]],
  ["espresso", "DeLonghi espresso machine", "$95", "Ain el Remmaneh", "Cynthia",
    "Dedica EC685, descaled monthly, with tamper and milk jug. Upgrading, nothing wrong with it.",
    ["kitchen", "home"]],
  ["inverter-ac", "12,000 BTU inverter AC", "$310", "Mansourieh", "Hadi",
    "Installed 2024, barely used one summer, remote and receipt included. Buyer removes or we arrange.",
    ["appliance", "cooling"]],
  ["standing-desk", "Desk + ergonomic chair", "$120", "Sin el Fil", "Jad",
    "140cm desk with cable tray and an adjustable mesh chair. Office closing, priced to go this week.",
    ["furniture", "office"]],
  ["yamaha-guitar", "Yamaha F310 acoustic guitar", "$140", "Jbeil", "Yara",
    "New strings, no cracks, with soft case and capo. Great starter guitar, honest wear in photos.",
    ["music", "hobby"]],
];

const services = [
  ["elie-electrician", "Elie — Emergency Electrician", "from $25/visit", "Bourj Hammoud", "Elie",
    "Quotes from photos first; breaker panels, water-heater faults, generator changeovers. 8 years in.",
    ["electrician", "emergency"]],
  ["nadia-math", "Nadia — Brevet/Bac Math Tutor", "$15/session", "Achrafieh", "Nadia",
    "Arabic/French explanations, after-5 availability. The agent tracks attendance and topics covered.",
    ["tutor", "math"]],
  ["layla-french", "Layla — French Tutor", "$12/session", "Hamra", "Layla",
    "Bac français and conversation. First session is a level assessment, plan comes as a checklist.",
    ["tutor", "french"]],
  ["maya-beauty", "Maya — Beauty at Home", "from $20/visit", "Dbayeh", "Maya",
    "At-home nails and blow-dry appointments with clear timing and a real menu — book in one message.",
    ["beauty", "at-home"]],
  ["marwan-ac", "Marwan — AC Service & Maintenance", "$30/unit", "Mansourieh", "Marwan",
    "Seasonal cleaning and gas top-ups. The agent reminds you before summer and books the slot.",
    ["ac", "maintenance"]],
  ["georges-mechanic", "Georges — Mobile Mechanic", "diagnostic $20", "Dekwaneh", "Georges",
    "Comes to you. Pre-purchase used-car inspections with a written report — pairs with the car listings.",
    ["mechanic", "mobile"]],
  ["tony-movers", "Tony — Moving & Transport", "fixed quote/move", "Sin el Fil", "Tony",
    "One fixed quote from your photos and floor count — no bidding war in a Facebook group at midnight.",
    ["movers", "transport"]],
  ["rima-cleaning", "Rima — Home Cleaning", "from $15/visit", "Jdeideh", "Rima",
    "Regular or one-off deep cleans, own supplies. The agent handles scheduling and reminders.",
    ["cleaning", "at-home"]],
  ["hassan-plumber", "Hassan — Plumber", "from $20/visit", "Furn el Chebbak", "Hassan",
    "Leaks, water heaters, pump pressure. Photo first, fixed quote before he rings the bell.",
    ["plumber", "emergency"]],
  ["carla-photographer", "Carla — Event Photographer", "from $80/event", "Jbeil", "Carla",
    "Weddings, baptisms, product shoots. Portfolio on request through the agent; edited photos in 5 days.",
    ["photography", "events"]],
];

const gigs = [
  ["abu-ali-moving", "Abu Ali — Moving + winch", "quoted once, in writing", "Beirut & suburbs", "Abu Ali",
    "Video-survey your stuff, get ONE final price. Winch for tight stairwells. No day-of extras.",
    ["moving", "winch"]],
  ["deep-cleaning", "Deep clean before move-in", "from $60", "Greater Beirut", "Em Joe's crew",
    "Team of 2, supplies included. Agent confirms scope from photos — kitchen, bathrooms, floors, balcony.",
    ["cleaning", "one-time"]],
  ["water-heater", "Water heater replacement — today", "$35 + parts", "Metn", "Said",
    "Same-day slot. Fixed labor price, parts receipt shared in chat before he buys anything.",
    ["plumbing", "same-day"]],
  ["cv-writing", "CV + cover letter in English", "$25", "remote", "Dana",
    "48h turnaround, ATS-friendly. The agent interviews you, the writer polishes — two revisions included.",
    ["writing", "remote"]],
  ["balcony-waterproofing", "Balcony waterproofing", "from $120", "Baabda", "Khalil",
    "Before winter rains. Membrane coating with a 2-year warranty noted in the agent's record.",
    ["waterproofing", "seasonal"]],
  ["wedding-photographer", "Wedding photographer — last minute", "$350/half-day", "Mount Lebanon", "Pierre",
    "Portfolio verified by the agent. Deposit held until delivery — edited gallery in 10 days.",
    ["photography", "wedding"]],
  ["furniture-assembly", "Flat-pack furniture assembly", "$10/item", "Beirut & Metn", "Roy",
    "IKEA and lookalikes — wardrobes, beds, desks. Send the box label, get a fixed count and time.",
    ["assembly", "home"]],
  ["generator-install", "Generator changeover install", "from $45", "Aley", "Fadi",
    "Manual or automatic changeover switch, tidy wiring, photo of the finished panel in your file.",
    ["electrical", "generator"]],
  ["car-detailing", "Full car detailing at your spot", "$35", "Jounieh–Beirut", "Chris",
    "Wash, interior vacuum, polish — he comes to your parking. Before/after photos through the agent.",
    ["car", "detailing"]],
];

function toListings(rows, type, imgDir) {
  return rows.map(([id, title, price, location, seller, desc, tags], i) => ({
    id, type, title, price, location, desc, tags, seller,
    agentVerified: true,
    ts: BASE_TS - i * 3600_000, // 1h apart, listed order = display order
    images: [1, 2, 3].map(n => `/images/${imgDir}/${id}/${n}.webp`),
    // private demo contact — the public GET strips this field
    sellerPhone: "+96171881367",
  }));
}

const listings = [
  ...toListings(things, "product", "things"),
  ...toListings(services, "service", "services"),
  ...toListings(gigs, "gig", "gigs"),
];

const put = listings.map(l => ({ key: `l:${l.id}`, value: JSON.stringify(l) }));
for (const type of ["product", "service", "gig"]) {
  put.push({
    key: `idx:${type}`,
    value: JSON.stringify(listings.filter(l => l.type === type).map(l => l.id)),
  });
}

// keys from the two previous seed rounds (incl. the broken \-price dupes)
const stale = [
  "23fcc23d", "139d43e1", "cd064160", "cf7b7d3b", "9e80a1d5", "c55d5728",
  ...Array.from({ length: 8 }, (_, i) => `seedproduct${i}`),
  "510a9015", "4fc65938", "3c26df48", "bba3085c", "61a52d6d", "454c75eb",
  ...Array.from({ length: 6 }, (_, i) => `seedservice${i}`),
  "1c411eed", "3aa8a49f", "6ff7e0bc", "1b9aa92e", "b7247216", "ce821a10",
  ...Array.from({ length: 6 }, (_, i) => `seedgig${i}`),
].map(id => `l:${id}`);

writeFileSync(new URL("kv-bulk-put.json", import.meta.url), JSON.stringify(put, null, 1));
writeFileSync(new URL("kv-bulk-delete.json", import.meta.url), JSON.stringify(stale, null, 1));
console.log(`${listings.length} listings -> kv-bulk-put.json, ${stale.length} stale keys -> kv-bulk-delete.json`);
