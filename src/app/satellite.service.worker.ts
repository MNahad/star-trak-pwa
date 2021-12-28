/// <reference lib="webworker" />

import type { Service } from '../../star-trak/pkg/star_trak';

const COORDS_PER_STATE = 3;
let service: Service;
const sgp4Data: GPElement[] = [];
let intervalId: number;

addEventListener(
  'message',
  ({ data: { gpElements, coords, period } }: MessageEvent<TrackerData>) => {
    if (!service && gpElements && coords) {
      const gpData = gpElements;
      import('../../star-trak/pkg/star_trak').then(({ Service }) => {
        service = new Service(
          JSON.stringify(gpElements),
          coords[0],
          coords[1],
          coords[2]
        );
        const idsArray = service.get_norad_ids();
        for (const rawId of idsArray) {
          const id = Number(rawId);
          sgp4Data.push(
            gpData.find(({ NORAD_CAT_ID }) => NORAD_CAT_ID === id)!
          );
        }
        intervalId = setInterval(update, period ?? 1000);
      });
    } else if (service) {
      if (coords) {
        service.update_observer(coords[0], coords[1], coords[2]);
      }
      if (period) {
        clearInterval(intervalId);
        intervalId = setInterval(update, period);
      }
    }
  }
);

function update() {
  if (!service) {
    return;
  }
  service.update();
  const positionsArray = service.get_constellation_geodetic_positions();
  const rangedPositionsArray = service.get_ranged_positions();
  const rangedVelocitiesArray = service.get_ranged_velocities();
  const positions: { lat_deg: number; lon_deg: number; alt_km: number }[] = [];
  const rangedPositions: {
    azimuth_deg: number;
    elevation_deg: number;
    range_km: number;
  }[] = [];
  const rangedVelocities: {
    east_km_s: number;
    north_km_s: number;
    up_km_s: number;
  }[] = [];
  for (
    let i = 0;
    i < sgp4Data.length * COORDS_PER_STATE;
    i += COORDS_PER_STATE
  ) {
    positions.push({
      lat_deg: positionsArray[i],
      lon_deg: positionsArray[i + 1],
      alt_km: positionsArray[i + 2],
    });
    rangedPositions.push({
      azimuth_deg: rangedPositionsArray[i],
      elevation_deg: rangedPositionsArray[i + 1],
      range_km: rangedPositionsArray[i + 2],
    });
    rangedVelocities.push({
      east_km_s: rangedVelocitiesArray[i],
      north_km_s: rangedVelocitiesArray[i + 1],
      up_km_s: rangedVelocitiesArray[i + 2],
    });
  }
  postMessage([
    positions,
    rangedPositions,
    rangedVelocities,
    sgp4Data.map(({ OBJECT_NAME }) => OBJECT_NAME),
  ]);
}

interface TrackerData {
  gpElements?: GPElement[];
  coords?: number[];
  period?: number;
}

interface GPElement {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}
