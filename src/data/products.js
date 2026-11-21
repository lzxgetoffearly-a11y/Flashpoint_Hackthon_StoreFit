// Shopping catalog for the layout.
// link.kind:
//  'exact'   = the 3D model represents this real product (per the model's published README)
//  'similar' = our 3D model is generic; the link opens one specific, comparable product page
// price = list price in USD read from the retailer's own site on PRICE_DATE (null = not captured).
export const PRICE_DATE = '2026-11-21'
const ikea = (slug) => `https://www.ikea.com/us/en/p/${slug}/`
const web = (path) => `https://www.webstaurantstore.com/${path}.html`
export const PRODUCTS = {
  bistro: { name: 'IKEA STENSELE table, anthracite, Ø70 cm', cat: 'Seating', price: 199.99, link: { kind: 'similar', retailer: 'IKEA', url: ikea('stensele-table-anthracite-anthracite-s79288230') } },
  chair: { name: 'IKEA SKÅLSTA chair, oak veneer / tubular metal', cat: 'Seating', price: 70, link: { kind: 'similar', retailer: 'IKEA', url: ikea('skalsta-chair-oak-veneer-tubular-metal-light-gray-beige-s79608745') } },
  stool: { name: 'IKEA YNGVAR bar stool, anthracite, 75 cm', cat: 'Seating', price: 185, link: { kind: 'similar', retailer: 'IKEA', url: ikea('yngvar-bar-stool-anthracite-60400745') } },
  windowbar: { name: 'IKEA KARLBY countertop, oak veneer, 188 cm (bar top; wall brackets separate)', cat: 'Seating', price: 199, link: { kind: 'similar', retailer: 'IKEA', url: ikea('karlby-countertop-oak-veneer-70335207') } },
  sofa: { name: 'Mercer41 Frankie velvet 86" sofa', cat: 'Lounge', price: null, link: { kind: 'exact', retailer: 'Wayfair', url: 'https://www.wayfair.com/furniture/pdp/mercer41-frankie-velvet-86-recessed-arm-sofa-bed-mcrf6337.html' } },
  armchair: { name: 'Bungalow Rose Griner slipper chair', cat: 'Lounge', price: null, link: { kind: 'similar', retailer: 'Wayfair', url: 'https://www.wayfair.com/furniture/pdp/bungalow-rose-griner-slipper-chair-bgrs8778.html' } },
  coffeetable: { name: 'IKEA BORGEBY coffee table, birch veneer, Ø70 cm', cat: 'Lounge', price: 199.99, link: { kind: 'similar', retailer: 'IKEA', url: ikea('borgeby-coffee-table-birch-veneer-70389356') } },
  lamp: { name: 'Beachcrest Home Clintonpark 1-light barn pendant, copper', cat: 'Lighting', price: null, link: { kind: 'exact', retailer: 'Wayfair', url: 'https://www.wayfair.com/lighting/pdp/beachcrest-home-clintonpark-1-light-dimmable-barn-light-bkwt7725.html?piid=33004628' } },
  plant: { name: 'IKEA FEJKA artificial potted monstera, 19 cm pot', cat: 'Decor', price: 49.99, link: { kind: 'similar', retailer: 'IKEA', url: ikea('fejka-artificial-potted-plant-indoor-outdoor-monstera-10615244') } },
  cup: { name: 'IKEA VÄRDERA coffee cup and saucer, 7 oz', cat: 'Decor', price: 7, link: { kind: 'similar', retailer: 'IKEA', url: ikea('vaerdera-coffee-cup-and-saucer-white-60277463') } },
  counter: { name: 'Eagle Group T2448SB 24" × 48" stainless work table (counter base; wood front and stone top are custom millwork)', cat: 'Bar & BOH', price: 599, link: { kind: 'similar', retailer: 'WebstaurantStore', url: web('eagle-group-t2448sb-24-x-48-stainless-steel-work-table-with-stainless-steel-undershelf/575T2448SB') } },
  espresso: { name: 'Estella Caffe ECEM2C two-group compact espresso machine, 110V', cat: 'Bar & BOH', price: 2979, link: { kind: 'similar', retailer: 'WebstaurantStore', url: web('estella-caffe-ecem2c-two-group-compact-automatic-espresso-machine-110v/236ECEM2C') } },
  pastry: { name: 'Avantco BCC-35-HC 34½" refrigerated countertop bakery case', cat: 'Bar & BOH', price: 829, link: { kind: 'similar', retailer: 'WebstaurantStore', url: web('avantco-bcc-35-hc-35-curved-glass-black-refrigerated-countertop-bakery-display-case/360BCC35HCB') } },
  fridge: { name: 'True T-19-HC 27" one-section reach-in refrigerator', cat: 'Bar & BOH', price: 3393.71, link: { kind: 'similar', retailer: 'WebstaurantStore', url: web('true-t19hc-27-one-section-solid-door-reachin-refrigerator/200T19HC') } },
  sink: { name: 'Steelton 54" three-compartment sink with drainboards', cat: 'Bar & BOH', price: 268.99, link: { kind: 'similar', retailer: 'WebstaurantStore', url: web('steelton-54-18-gauge-stainless-steel-three-compartment-sink-with-2-drainboards-10-x-14-x-12-bowls/522CS31014LK') } },
  shelf: { name: 'IKEA LACK wall shelf, oak effect, 110 cm', cat: 'Bar & BOH', price: null, link: { kind: 'similar', retailer: 'IKEA', url: ikea('lack-wall-shelf-white-stained-oak-effect-60383519') } },
}
