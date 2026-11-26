// Raffle prizes shown in the "See the prizes" panel (DESIGN.md Section 0). Content only:
// change items, quantities or photos here. Photos live in public/prizes/; leave `photo` out
// for items without one (those rows are plain text). No prices, no logos.

export type RafflePrize = { name: string; quantity: number; photo?: string }
export type RaffleSponsor = { sponsor: string; prizes: RafflePrize[] }

export const RAFFLE_PRIZES: RaffleSponsor[] = [
  {
    sponsor: 'Columbia',
    prizes: [
      { name: 'Men’s Puffect Vest (Medium)', quantity: 1, photo: '/prizes/columbia-puffect-vest.jpg' },
      { name: 'Women’s Puffect Jacket (Medium)', quantity: 1, photo: '/prizes/columbia-puffect-jacket.jpg' },
      { name: 'Men’s Trailborne 2.5L Shell (Medium)', quantity: 2, photo: '/prizes/columbia-trailborne-shell.jpg' },
      { name: 'Trail Traveler 18L Backpack', quantity: 1, photo: '/prizes/columbia-trail-traveler-backpack.jpg' },
      { name: 'Cottonwood Creek Tote Bag', quantity: 1, photo: '/prizes/columbia-cottonwood-creek-tote.jpg' },
      { name: 'Street Transit Side Bag', quantity: 1, photo: '/prizes/columbia-street-transit-side-bag.jpg' },
      { name: 'Cottonwood Creek Side Bag', quantity: 1, photo: '/prizes/columbia-cottonwood-creek-side-bag.jpg' },
      { name: 'Zigzag Hip Pack', quantity: 1, photo: '/prizes/columbia-zigzag-hip-pack.jpg' },
      { name: 'Columbia vouchers', quantity: 275 },
    ],
  },
  {
    sponsor: 'The Coffee Bean & Tea Leaf',
    prizes: [
      { name: 'Tumblers', quantity: 15 },
      { name: 'Vouchers', quantity: 6 },
    ],
  },
  {
    sponsor: 'Nono’s',
    prizes: [
      { name: 'Vouchers', quantity: 6 },
    ],
  },
  {
    sponsor: 'RAF Forwarding',
    prizes: [
      { name: 'Popcorn maker', quantity: 1 },
    ],
  },
]
