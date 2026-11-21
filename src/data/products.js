// Shopping catalog for the layout. `link.kind`:
//  'exact'   = the 3D model represents this real product (per the model's published README)
//  'similar' = our model is generic; the link opens a retailer search for comparable items
const ikea = (q) => `https://www.ikea.com/us/en/search/?q=${encodeURIComponent(q)}`
const shop = (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`
export const PRODUCTS = {
  bistro: { name: 'Round bistro table, marble-look top, Ø70 cm', cat: 'Seating', link: { kind: 'similar', retailer: 'IKEA', url: ikea('bistro table') } },
  chair: { name: 'Cafe chair, oak seat, black steel frame', cat: 'Seating', link: { kind: 'similar', retailer: 'IKEA', url: ikea('dining chair oak black') } },
  stool: { name: 'Bar stool with footrest, 75 cm', cat: 'Seating', link: { kind: 'similar', retailer: 'IKEA', url: ikea('bar stool footrest') } },
  windowbar: { name: 'Wall-mounted bar counter, oak', cat: 'Seating', link: { kind: 'similar', retailer: 'IKEA', url: ikea('bar table wall') } },
  sofa: { name: 'Mercer41 Frankie velvet 86" sofa', cat: 'Lounge', link: { kind: 'exact', retailer: 'Wayfair', url: 'https://www.wayfair.com/furniture/pdp/mercer41-frankie-velvet-86-recessed-arm-sofa-bed-mcrf6337.html' } },
  armchair: { name: 'Velvet slipper chair (fabric modeled on Bungalow Rose Griner)', cat: 'Lounge', link: { kind: 'similar', retailer: 'Wayfair', url: 'https://www.wayfair.com/furniture/pdp/bungalow-rose-griner-slipper-chair-bgrs8778.html' } },
  coffeetable: { name: 'Low round coffee table', cat: 'Lounge', link: { kind: 'similar', retailer: 'IKEA', url: ikea('round coffee table') } },
  lamp: { name: 'Beachcrest Home Clintonpark 1-light barn pendant, copper', cat: 'Lighting', link: { kind: 'exact', retailer: 'Wayfair', url: 'https://www.wayfair.com/lighting/pdp/beachcrest-home-clintonpark-1-light-dimmable-barn-light-bkwt7725.html?piid=33004628' } },
  plant: { name: 'Potted plant, large', cat: 'Decor', link: { kind: 'similar', retailer: 'IKEA', url: ikea('potted plant large') } },
  cup: { name: 'Ceramic cup and saucer', cat: 'Decor', link: { kind: 'similar', retailer: 'IKEA', url: ikea('cup saucer') } },
  counter: { name: 'Service counter module 120 cm, quartz top', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'Google Shopping', url: shop('commercial service counter quartz top') } },
  espresso: { name: 'Commercial 2-group espresso machine', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'Google Shopping', url: shop('commercial 2 group espresso machine') } },
  pastry: { name: 'Refrigerated pastry display case', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'Google Shopping', url: shop('refrigerated pastry display case countertop') } },
  fridge: { name: 'Reach-in refrigerator, stainless', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'Google Shopping', url: shop('commercial reach in refrigerator stainless') } },
  sink: { name: '3-compartment sink, stainless', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'Google Shopping', url: shop('3 compartment sink stainless') } },
  shelf: { name: 'Open wall shelving, oak & steel', cat: 'Bar & BOH', link: { kind: 'similar', retailer: 'IKEA', url: ikea('wall shelf oak') } },
}
