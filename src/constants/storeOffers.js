/**
 * Offers priced in real money.
 *
 * NOT PURCHASABLE YET. Nothing here reaches StoreKit or Play Billing, and
 * tapping any of it says so. The offers are laid out the way they will sell, so
 * that switching purchases on means wiring a store SDK to these product ids,
 * not redesigning the shop.
 *
 * `listPrice` is what each product is planned to cost in `LIST_CURRENCY`, for
 * setting it up in App Store Connect and Play Console. It is never shown: once
 * purchases are live, the price on screen is the one the store returns, in the
 * buyer's currency, because only the store knows what the buyer is charged.
 *
 * Product ids are the same on both stores. Apple does not allow an id to be
 * reused once created, even after deleting the product, so these are final.
 */

/**
 * Real-money prices stay off screen until purchases go through the store.
 *
 * Apple rejects apps that show a price for something that cannot actually be
 * bought through in-app purchase, and a "€4.99" that only answers "coming
 * soon" is exactly that. The offers keep their place in the shop; their
 * buttons say "Coming soon". Flip this once StoreKit and Play Billing are wired
 * in.
 */
export const IAP_ENABLED = false;

export const LIST_CURRENCY = 'EUR';

/**
 * Bundles. Each includes an avatar frame that nothing else sells, which is
 * what makes them non-consumable purchases on the store: bought once, restored
 * on a new phone.
 *
 * No "was" price. A struck-through figure the product was never sold at is a
 * misleading reference price under EU consumer law, and it is the first thing
 * a reviewer checks.
 */
export const OFFERS = [
  {
    id: 'starter',
    productId: 'sportify.offer.starter',
    kind: 'non_consumable',
    label: 'One-time offer',
    name: 'Starter Pack',
    frameId: 'a13',
    energy: 6000,
    freezes: 3,
    listPrice: 4.99,
    oncePerAccount: true,
  },
  {
    id: 'phoenix',
    productId: 'sportify.offer.phoenix',
    kind: 'non_consumable',
    label: 'Exclusive bundle',
    name: 'Phoenix Bundle',
    frameId: 'a14',
    energy: 8000,
    xpBoosts: 1,
    listPrice: 9.99,
  },
];

/**
 * Energy, smallest to largest. Consumable: bought as often as wanted.
 *
 * The bonus on each is not written here. It is worked out from these numbers
 * against the smallest pack (src/lib/offers.js), so the "+N%" on a card is
 * always true of the pack it is on.
 */
export const ENERGY_PACKS = [
  { id: 'pouch', productId: 'sportify.energy.500', name: 'Pouch', energy: 500, listPrice: 0.99 },
  { id: 'sack', productId: 'sportify.energy.2800', name: 'Sack', energy: 2800, listPrice: 4.99 },
  { id: 'chest', productId: 'sportify.energy.6100', name: 'Chest', energy: 6100, listPrice: 9.99, tag: 'Most popular' },
  { id: 'crate', productId: 'sportify.energy.13200', name: 'Crate', energy: 13200, listPrice: 19.99 },
  { id: 'vault', productId: 'sportify.energy.35500', name: 'Vault', energy: 35500, listPrice: 49.99, tag: 'Best value' },
];
