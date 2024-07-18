import { IExternalProvider } from '../../../../types/ExternalProvider';
import { Moralis } from './moralis';

export default {
  moralis: Moralis
} as { [key: string]: IExternalProvider }