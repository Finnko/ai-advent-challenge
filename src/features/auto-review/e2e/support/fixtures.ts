const IMAGE = 'https://13.design.pages.academy/static'

export type OfferListItem = {
  id: string
  title: string
  type: string
  price: number
  previewImage: string
  city: {
    name: string
    location: { latitude: number; longitude: number; zoom: number }
  }
  location: { latitude: number; longitude: number; zoom: number }
  isFavorite: boolean
  isPremium: boolean
  rating: number
}

export type OfferFull = OfferListItem & {
  description: string
  images: string[]
  goods: string[]
  host: { isPro: boolean; name: string; avatarUrl: string }
  bedrooms: number
  maxAdults: number
}

export const USER = {
  name: 'Test user',
  avatarUrl: `${IMAGE}/avatar/3.jpg`,
  isPro: false,
  email: 'test-user@htmlacademy.ru',
  token: 'token',
}

export const OFFERS: OfferListItem[] = [
  {
    id: 'regular-offer-paris',
    title: 'Offer #1',
    type: 'house',
    price: 929,
    previewImage: `${IMAGE}/hotel/10.jpg`,
    city: {
      name: 'Paris',
      location: { latitude: 48.85661, longitude: 2.351499, zoom: 13 },
    },
    location: { latitude: 48.86861, longitude: 2.342499, zoom: 16 },
    isFavorite: false,
    isPremium: false,
    rating: 2.1,
  },
  {
    id: 'premium-offer-paris',
    title: 'Offer #2',
    type: 'room',
    price: 137,
    previewImage: `${IMAGE}/hotel/13.jpg`,
    city: {
      name: 'Paris',
      location: { latitude: 48.85661, longitude: 2.351499, zoom: 13 },
    },
    location: { latitude: 48.85861, longitude: 2.330499, zoom: 16 },
    isFavorite: false,
    isPremium: true,
    rating: 4.9,
  },
  {
    id: 'regular-offer-cologne',
    title: 'Offer #3',
    type: 'apartment',
    price: 271,
    previewImage: `${IMAGE}/hotel/11.jpg`,
    city: {
      name: 'Cologne',
      location: { latitude: 50.938361, longitude: 6.959974, zoom: 13 },
    },
    location: { latitude: 50.950361, longitude: 6.961974, zoom: 16 },
    isFavorite: false,
    isPremium: false,
    rating: 5,
  },
  {
    id: 'premium-offer-amsterdam',
    title: 'Offer #4',
    type: 'house',
    price: 633,
    previewImage: `${IMAGE}/hotel/8.jpg`,
    city: {
      name: 'Amsterdam',
      location: { latitude: 52.37454, longitude: 4.897976, zoom: 13 },
    },
    location: { latitude: 52.36554, longitude: 4.911976, zoom: 16 },
    isFavorite: false,
    isPremium: true,
    rating: 3.3,
  },
  {
    id: 'regular-offer-hamburg',
    title: 'Offer #5',
    type: 'hotel',
    price: 401,
    previewImage: `${IMAGE}/hotel/17.jpg`,
    city: {
      name: 'Hamburg',
      location: { latitude: 53.550341, longitude: 10.000654, zoom: 13 },
    },
    location: { latitude: 53.528341, longitude: 10.018654, zoom: 16 },
    isFavorite: false,
    isPremium: true,
    rating: 4,
  },
]

export const REGULAR_OFFER: OfferFull = {
  ...OFFERS[0],
  description: 'Regular Paris offer description.',
  images: [
    `${IMAGE}/hotel/10.jpg`,
    `${IMAGE}/hotel/8.jpg`,
    `${IMAGE}/hotel/16.jpg`,
    `${IMAGE}/hotel/4.jpg`,
    `${IMAGE}/hotel/5.jpg`,
    `${IMAGE}/hotel/20.jpg`,
  ],
  goods: ['Air conditioning'],
  host: {
    isPro: false,
    name: 'Angelina',
    avatarUrl: `${IMAGE}/host/avatar-angelina.jpg`,
  },
  bedrooms: 1,
  maxAdults: 1,
}

export const PREMIUM_OFFER: OfferFull = {
  ...OFFERS[1],
  price: 236,
  description: 'Premium Paris offer description.',
  images: [
    `${IMAGE}/hotel/13.jpg`,
    `${IMAGE}/hotel/8.jpg`,
    `${IMAGE}/hotel/16.jpg`,
    `${IMAGE}/hotel/4.jpg`,
    `${IMAGE}/hotel/5.jpg`,
    `${IMAGE}/hotel/20.jpg`,
    `${IMAGE}/hotel/17.jpg`,
  ],
  goods: ['Air conditioning', 'Fridge'],
  host: {
    isPro: true,
    name: 'Angelina',
    avatarUrl: `${IMAGE}/host/avatar-angelina.jpg`,
  },
  bedrooms: 2,
  maxAdults: 2,
}

export const COLOGNE_OFFER: OfferFull = {
  ...OFFERS[2],
  description: 'Regular Cologne offer description.',
  images: [`${IMAGE}/hotel/11.jpg`],
  goods: ['Air conditioning'],
  host: {
    isPro: false,
    name: 'Angelina',
    avatarUrl: `${IMAGE}/host/avatar-angelina.jpg`,
  },
  bedrooms: 1,
  maxAdults: 1,
}

export const FAVORITES: OfferListItem[] = [
  { ...OFFERS[0], isFavorite: true, isPremium: true },
  { ...OFFERS[1], isFavorite: true },
  { ...OFFERS[2], isFavorite: true },
]

export const NEARBY: OfferListItem[] = [OFFERS[3], OFFERS[4], OFFERS[2]]

export type Review = {
  id: string
  comment: string
  date: string
  rating: number
  user: { name: string; avatarUrl: string; isPro: boolean }
}

function review(
  index: number,
  comment: string,
  date: string,
  rating: number,
): Review {
  return {
    id: `review-${index}`,
    comment,
    date,
    rating,
    user: {
      name: 'Isaac',
      avatarUrl: `${IMAGE}/avatar/3.jpg`,
      isPro: true,
    },
  }
}

export const REVIEWS: Review[] = [
  review(7, 'Comment #7', '2023-11-14T21:00:00.594Z', 4),
  review(9, 'Comment #9', '2023-10-14T21:00:00.594Z', 4),
  review(5, 'Comment #5', '2023-06-15T21:00:00.594Z', 4),
  review(12, 'Comment #12', '2023-06-30T21:00:00.594Z', 4),
  review(8, 'Comment #8', '2023-06-14T12:00:00.594Z', 4),
  review(2, 'Comment #2', '2023-06-14T21:00:00.594Z', 4),
  review(1, 'Comment #1', '2023-05-14T21:00:00.594Z', 4),
  review(11, 'Comment #11', '2023-05-14T15:00:00.594Z', 4),
  review(3, 'Comment #3', '2023-03-14T21:00:00.594Z', 4),
  review(4, 'Comment #4', '2023-02-14T21:00:00.594Z', 4),
  review(6, 'Comment #6', '2023-09-14T21:00:00.594Z', 4),
  review(10, 'Comment #10', '2023-01-14T21:00:00.594Z', 4),
]

export const NEW_REVIEW: Review = {
  id: 'new-review',
  date: '2025-08-08T14:13:56.569Z',
  user: { name: 'Test user', avatarUrl: `${IMAGE}/avatar/3.jpg`, isPro: false },
  comment: 'New Comment',
  rating: 3,
}
