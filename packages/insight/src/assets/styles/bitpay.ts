import {Black, Action, White, LinkBlue, LightBlack} from './colors';

export type BitPayTheme = {
  dark: boolean;
  colors: {
    color: string;
    background: string;
    link: string;
    borderColor: string;
  };
};

export const BitPayLightTheme: BitPayTheme = {
  dark: false,
  colors: {
    color: Black,
    background: White,
    link: Action,
    borderColor: LightBlack,
  },
};

export const BitPayDarkTheme: BitPayTheme = {
  dark: true,
  colors: {
    color: White,
    background: Black,
    link: LinkBlue,
    borderColor: '#C4C4C4',
  },
};
