import { Injectable } from '@angular/core';
import { fromEvent } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SatelliteService {
  private tracker = new Worker('./satellite.service.worker', {
    type: 'module',
  });
  tracker$ = fromEvent<MessageEvent<SatelliteData>>(this.tracker, 'message');

  startTracker({
    observer: { lat_deg, lon_deg, alt_km },
    period,
  }: TrackerConfig): void {
    fetch(environment.gpUrl)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          return Promise.reject();
        }
      })
      .then((gpElements) => {
        this.tracker.postMessage({
          gpElements,
          coords: [lat_deg, lon_deg, alt_km],
          period,
        });
      })
      .catch(() => {
        console.error('Cannot start satellite tracker!');
      });
  }

  updateObserver({
    lat_deg,
    lon_deg,
    alt_km,
  }: TrackerConfig['observer']): void {
    this.tracker.postMessage({
      coords: [lat_deg, lon_deg, alt_km],
    });
  }

  updatePeriod(period: TrackerConfig['period']): void {
    this.tracker.postMessage({ period });
  }
}

export interface SatelliteGeodetic {
  lat_deg: number;
  lon_deg: number;
  alt_km: number;
}

export interface SatelliteHorizontal {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
}

export interface SatelliteTopocentric {
  east_km_s: number;
  north_km_s: number;
  up_km_s: number;
}

type SatelliteData = [
  SatelliteGeodetic[],
  SatelliteHorizontal[],
  SatelliteTopocentric[],
  string[]
];

interface TrackerConfig {
  observer: {
    lat_deg: number;
    lon_deg: number;
    alt_km: number;
  };
  period: number;
}
