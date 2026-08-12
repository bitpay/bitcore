import * as request from 'request';
import config from '../config';
import { logger } from './logger';

export interface BrazeTrackEvent {
  externalId: string;
  name: string;
  time?: string; // ISO8601, defaults to now
  properties?: Record<string, any>;
}

/**
 * Minimal client for the Braze REST API "track" endpoint, used to log custom
 * events against a user profile (https://www.braze.com/docs/api/endpoints/user_data/post_user_track/).
 */
class BrazeService {
  request: any = request;

  /**
   * Fire-and-forget: never rejects. Callers should not await this before
   * responding to time-sensitive requests (e.g. partner webhooks).
   */
  trackEvent(event: BrazeTrackEvent): Promise<void> {
    return new Promise(resolve => {
      const url: string | undefined = config.braze?.bwsTrackEventApi;
      const apiKey: string | undefined = config.braze?.bwsTrackEventApiKey;
      if (!url || !apiKey) {
        logger.warn('Braze trackEvent skipped: bwsTrackEventApi/bwsTrackEventApiKey not configured');
        return resolve();
      }
      if (!event.externalId) {
        logger.debug('Braze trackEvent skipped: missing externalId (event=%s)', event.name);
        return resolve();
      }

      const body = {
        events: [
          {
            external_id: event.externalId,
            name: event.name,
            time: event.time || new Date().toISOString(),
            properties: event.properties || {}
          }
        ]
      };

      this.request.post(
        url + '/users/track',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey
          },
          body,
          json: true
        },
        (err, _res, data) => {
          if (err) {
            logger.warn('Braze trackEvent request failed (event=%s): %o', event.name, err);
          } else if (data?.errors?.length) {
            logger.warn('Braze trackEvent returned errors (event=%s): %o', event.name, data.errors);
          }
          return resolve();
        }
      );
    });
  }
}

export const brazeService = new BrazeService();
