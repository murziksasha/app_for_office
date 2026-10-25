export const APP_NAME = 'Folio';
export const APP_VERSION = '1.0.0';
export const APP_TAGLINE = 'Local-first office suite for documents, spreadsheets, and presentations';

export const AUTHOR_NAME = 'Oleksandr Hryhoriev';
export const AUTHOR_EMAIL = '1versuses1@gmail.com';
export const AUTHOR_PHONE = '063 556 70 90';
export const AUTHOR_PLACE_EN = 'Ukraine, Chornomorsk';
export const AUTHOR_PLACE_UK = 'Україна, Чорноморськ';

export interface AboutIdentity {
  name: string;
  email: string;
  phone: string;
  placeEn: string;
  placeUk: string;
}

export const ABOUT_IDENTITY: AboutIdentity = {
  name: AUTHOR_NAME,
  email: AUTHOR_EMAIL,
  phone: AUTHOR_PHONE,
  placeEn: AUTHOR_PLACE_EN,
  placeUk: AUTHOR_PLACE_UK,
};

export function getAuthorPlace(language?: string): string {
  const isUk = (language || '').toLowerCase().startsWith('uk');
  return isUk ? AUTHOR_PLACE_UK : AUTHOR_PLACE_EN;
}

