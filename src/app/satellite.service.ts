import { Injectable } from '@angular/core';
import { fromEvent } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SatelliteService {
  private tracker = new Worker('./satellite.service.worker', { type: 'module' });
  tracker$ = fromEvent<MessageEvent<SatelliteData>>(this.tracker, 'message');

  startTracker({ observer: { lat_deg, lon_deg, alt_km }, period }: TrackerConfig): void {
    fetch("../assets/wasm/data.json")
      .then(res => res.json())
      .then(gpElements => {
        this.tracker.postMessage({
          gpElements,
          coords: [lat_deg, lon_deg, alt_km],
          period,
        });
      });
  }

  updateObserver({ lat_deg, lon_deg, alt_km }: TrackerConfig["observer"]): void {
    this.tracker.postMessage({
      coords: [lat_deg, lon_deg, alt_km],
    });
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

type SatelliteData = [SatelliteGeodetic[], SatelliteHorizontal[]];

interface TrackerConfig {
  observer: {
    lat_deg: number;
    lon_deg: number;
    alt_km: number;
  };
  period: number;
}
