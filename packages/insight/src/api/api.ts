import useSWR from 'swr';
import {urlSafetyCheck} from '../utilities/helper-methods';
import axios from 'axios';

export const fetcher = (url: string) => axios.get(url).then(res => res.data);
export const useApi = (url: string, options?: object) =>
  useSWR(urlSafetyCheck(url), fetcher, options);
