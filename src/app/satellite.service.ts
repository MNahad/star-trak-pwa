import { Injectable } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';

export namespace SatelliteService {

  @Injectable({
    providedIn: 'root'
  })
  export class SatelliteService {
    private tracker: Worker | undefined;
    private tracker$: Observable<MessageEvent<EventData>> | undefined;
    private satellites: SatelliteGeodetic[] = [];
    private localisedSatellites: SatelliteHorizontal[] = [];

    constructor() {
      if (typeof Worker !== 'undefined') {
        this.prepWorker();
      }
    }

    getAllSats(): SatelliteGeodetic[] {
      return this.satellites;
    }

    getRangedSats(): SatelliteHorizontal[] {
      return this.localisedSatellites;
    }

    startTracker({ observer: { lat_deg, lon_deg, alt_km }, duration }: TrackerConfig): void {
      fetch("../assets/wasm/data.json")
        .then(res => res.json())
        .then(gpElements => {
          this.tracker?.postMessage({
            gpElements,
            coords: [lat_deg, lon_deg, alt_km],
            duration,
          });
        });
    }

    private prepWorker(): void {
      this.tracker = new Worker('./satellite.service.worker', { type: 'module' });
      this.tracker$ = fromEvent<MessageEvent<EventData>>(this.tracker, 'message');
      this.tracker$.subscribe(({ data }) => {
        this.satellites = data[0];
        this.localisedSatellites = data[1];
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
