/**
 * Offers priced in real money.
 *
 * NOT PURCHASABLE YET. Nothing here reaches StoreKit or Play Billing, and
 * tapping any of it says so. These exist so the shop can be laid out the way
 * it is going to look, and so that adding in-app purchases later means giving
 * each entry a store product id rather than redesigning the screen.
 *
 * Prices are display strings on purpose. The real ones will come from the
 * store at runtime: they have to match what the buyer is charged, in the
 * buyer's currency, and only the store knows that.
 */

/**
 * Real-money prices stay off screen until purchases go through the store.
 *
 * Apple rejects apps that show a price for something that cannot actually be
 * bought through in-app purchase, and a "$4.99" that only answers "coming
 * soon" is exactly that. The offers keep their place in the shop; their
 * buttons say "Soon". Flip this once StoreKit and Play Billing are wired in.
 */
export const IAP_ENABLED = false;

export const FEATURED_BUNDLE = {
  id: 'ascension_starter',
  label: 'Limited offer',
  name: 'Starter Pack',
  energy: 2500,
  freezes: 3,
  perk: 'Includes the Golden Apex avatar frame',
  price: '$4.99',
  was: '$14.99',
};

/**
 * `featured` is the pack the row is built around — lifted, lit, gold button.
 * `cool` switches its accents to periwinkle, which is how the best-value pack
 * stays distinct from the featured one without a third colour.
 */
export const ENERGY_PACKS = [
  { id: 'energy_pouch', label: 'Small', energy: 1000, price: '$1.99' },
  { id: 'energy_chest', label: 'Medium', energy: 3500, price: '$4.99', tag: '+25% bonus', featured: true },
  { id: 'energy_vault', label: 'Large', energy: 10000, price: '$12.99', tag: 'Best value', cool: true },
];
