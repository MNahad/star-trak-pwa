import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SensorService {
  private sensors: Sensors;

  static isReading<T>(data: SensorData<T>): data is { reading: T } {
    return 'reading' in data;
  }
  static isState<T>(data: SensorData<T>): data is { state: boolean } {
    return 'state' in data;
  }

  constructor() {
    const defineSensor = <_, U>(): Sensor<_, U> => {
      const data = new Subject<SensorData<U>>();
      return {
        state: false,
        device: undefined,
        data,
        observable$: data.asObservable(),
      };
    };
    this.sensors = {
      nineAxis: defineSensor(),
      geo: defineSensor(),
    };
    this.init();
  }

  getSensor$<K extends keyof Sensors>(sensor: keyof Sensors): Sensors[K]["observable$"] {
    return this.sensors[sensor].observable$;
  }

  private init(): void {
    this.discover("nineAxis");
    this.discover("geo");
    if (this.sensors.nineAxis.state) {
      this.start("nineAxis");
    }
    if (this.sensors.geo.state) {
      this.start("geo");
    }
  }

  private discover(sensor: keyof Sensors): void {
    switch (sensor) {
      case "nineAxis":
        const nineAxis = this.sensors.nineAxis;
        if ('AbsoluteOrientationSensor' in window) {
          try {
            nineAxis.device = new AbsoluteOrientationSensor({
              frequency: 50,
              referenceFrame: 'screen',
            });
            nineAxis.state = true;
          } catch {
            nineAxis.state = false;
          }
        } else {
          nineAxis.state = false;
        }
        break;
      case "geo":
        const geo = this.sensors.geo;
        if (navigator.geolocation) {
          geo.device = navigator.geolocation;
          geo.state = true;
        } else {
          geo.state = false;
        }
        break;
    }
  }

  private start(sensor: keyof Sensors): void {
    switch (sensor) {
      case "nineAxis":
        const nineAxis = this.sensors.nineAxis;
        if (!nineAxis.device) {
          break;
        }
        nineAxis.device.onreading = () => {
          nineAxis.state = true;
          nineAxis.data.next({ state: true });
          nineAxis.data.next({ reading: nineAxis.device!.quaternion! });
        };
        nineAxis.device.onerror = ({ error: { name } }) => {
          switch (name) {
            case 'NotAllowedError':
            case 'NotReadableError':
            case 'SecurityError':
            default:
              nineAxis.state = false;
              nineAxis.data.next({ state: false });
          }
        };
        nineAxis.device.start();
        break;
      case "geo":
        const geo = this.sensors.geo;
        if (!geo.device) {
          break;
        }
        geo.device.watchPosition(
          ({ coords: { latitude, longitude, altitude } }) => {
            geo.state = true;
            geo.data.next({ state: true });
            geo.data.next({ reading: [latitude, longitude, altitude ?? 0] });
          },
          ({ code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT }) => {
            switch (code) {
              case PERMISSION_DENIED:
              case POSITION_UNAVAILABLE:
              case TIMEOUT:
              default:
                geo.state = false;
                geo.data.next({ state: false });
                break;
            }
          },
        );
        break;
    }
  }
}

export type SensorData<T> = { state: boolean } | { reading: T };

interface Sensor<T, U> {
  state: boolean;
  device?: T;
  data: Subject<SensorData<U>>;
  observable$: Observable<SensorData<U>>;
}

interface Sensors {
  nineAxis: Sensor<AbsoluteOrientationSensor, number[]>;
  geo: Sensor<Geolocation, number[]>;
}
