import useSWR from 'swr';
import {urlSafetyCheck} from '../utilities/helper-methods';
import axios, { AxiosRequestConfig } from 'axios';

export const fetcher = (url: string, config?: AxiosRequestConfig) => axios.get(url, config).then(res => res.data);
export const useApi = (url: string, options?: object) =>
  useSWR(urlSafetyCheck(url), fetcher, options);
