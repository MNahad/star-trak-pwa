import { Injectable } from '@angular/core';
import { fromEvent } from 'rxjs';

export namespace SatelliteService {

  @Injectable({
    providedIn: 'root'
  })
  export class SatelliteService {
    private tracker = new Worker('./satellite.service.worker', { type: 'module' });
    tracker$ = fromEvent<MessageEvent<EventData>>(this.tracker, 'message');

    startTracker({ observer: { lat_deg, lon_deg, alt_km }, duration }: TrackerConfig): void {
      fetch("../assets/wasm/data.json")
        .then(res => res.json())
        .then(gpElements => {
          this.tracker.postMessage({
            gpElements,
            coords: [lat_deg, lon_deg, alt_km],
            duration,
          });
        });
    }
  }

  export type TrackerConfig = {
    observer: {
      lat_deg: number;
      lon_deg: number;
      alt_km: number;
    };
    duration: number;
  };

  export type SatelliteGeodetic = {
    lat_deg: number;
    lon_deg: number;
    alt_km: number;
  };

  export type SatelliteHorizontal = {
    azimuth_deg: number;
    elevation_deg: number;
    range_km: number;
  };

  type EventData = [SatelliteGeodetic[], SatelliteHorizontal[]];
}
