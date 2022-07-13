import 'styled-components';
import {BitPayTheme} from './src/assets/styles/bitpay';

declare module 'styled-components' {
  export interface DefaultTheme extends BitPayTheme {}
}
