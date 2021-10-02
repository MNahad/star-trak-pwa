import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SensorService {
  private sensors: Sensors;
  private capability: Capability;

  static isReading<T>(data: SensorData<T>): data is { reading: T } {
    return 'reading' in data;
  }
  static isState<T>(data: SensorData<T>): data is { state: boolean } {
    return 'state' in data;
  }

  constructor() {
    const performance: Capability["performance"] = new Subject();
    this.capability = {
      performance,
      performance$: performance.asObservable(),
    };

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
      sixAxis: defineSensor(),
      geo: defineSensor(),
    };

    this.init();
  }

  getSensor$<K extends keyof Sensors>(sensor: keyof Sensors): Sensors[K]["observable$"] {
    return this.sensors[sensor].observable$;
  }

  getCapability$(): Capability["performance$"] {
    return this.capability.performance$;
  }

  requestSensorActivation(sensor: keyof Sensors): void {
    this.discover(sensor);
    if (this.sensors[sensor].state) {
      this.start(sensor);
    }
  }

  private init(): void {
    this.requestSensorActivation("nineAxis");
    setInterval(() => this.reportPerformance(), 1000);
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
      case "sixAxis":
        const sixAxis = this.sensors.sixAxis;
        if ('RelativeOrientationSensor' in window) {
          try {
            sixAxis.device = new RelativeOrientationSensor({
              frequency: 50,
              referenceFrame: 'screen',
            });
            sixAxis.state = true;
          } catch {
            sixAxis.state = false;
          }
        } else {
          sixAxis.state = false;
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
          this.updateSensor("nineAxis", true, nineAxis.device!.quaternion!);
        };
        nineAxis.device.onerror = ({ error: { name } }) => {
          switch (name) {
            case 'NotAllowedError':
            case 'NotReadableError':
            case 'SecurityError':
            default:
              this.updateSensor("nineAxis", false);
              break;
          }
        };
        nineAxis.device.start();
        break;
      case "sixAxis":
        const sixAxis = this.sensors.sixAxis;
        if (!sixAxis.device) {
          break;
        }
        sixAxis.device.onreading = () => {
          this.updateSensor("nineAxis", true, sixAxis.device!.quaternion!);
        };
        sixAxis.device.onerror = ({ error: { name } }) => {
          switch (name) {
            case 'NotAllowedError':
            case 'NotReadableError':
            case 'SecurityError':
            default:
              this.updateSensor("sixAxis", false);
              break;
          }
        };
        sixAxis.device.start();
        break;
      case "geo":
        const geo = this.sensors.geo;
        if (!geo.device) {
          break;
        }
        geo.device.watchPosition(
          ({ coords: { latitude, longitude, altitude } }) => {
            this.updateSensor("geo", true, [latitude, longitude, altitude ?? 0]);
          },
          ({ code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT }) => {
            switch (code) {
              case PERMISSION_DENIED:
              case POSITION_UNAVAILABLE:
              case TIMEOUT:
              default:
                this.updateSensor("geo", false);
                break;
            }
          },
        );
        break;
    }
  }

  private updateSensor(name: keyof Sensors, state: boolean, reading?: number[]): void {
    const sensor = this.sensors[name];
    sensor.state = state;
    sensor.data.next({ state });
    reading?.length && sensor.data.next({ reading });
    this.reportPerformance();
  }

  private reportPerformance(): void {
    if (this.sensors.nineAxis.state && this.sensors.geo.state) {
      this.capability.performance.next("FULL");
      return;
    }
    if (Object.values(this.sensors).every(({ state }) => !state)) {
      this.capability.performance.next("OFF");
      return;
    }
    if (!this.sensors.geo.state) {
      this.capability.performance.next("NO_POSITION");
    }
    if (!this.sensors.nineAxis.state && this.sensors.sixAxis.state) {
      this.capability.performance.next("NO_HEADING");
    } else if (!(this.sensors.nineAxis.state || this.sensors.sixAxis.state)) {
      this.capability.performance.next("NO_ORIENTATION");
    }
  }
}

type SensorData<T> = { state: boolean } | { reading: T };

interface Sensor<T, U> {
  state: boolean;
  device?: T;
  data: Subject<SensorData<U>>;
  observable$: Observable<SensorData<U>>;
}

interface Sensors {
  nineAxis: Sensor<AbsoluteOrientationSensor, number[]>;
  sixAxis: Sensor<RelativeOrientationSensor, number[]>;
  geo: Sensor<Geolocation, number[]>;
}

enum Mode {
  FULL,
  NO_HEADING,
  NO_POSITION,
  NO_ORIENTATION,
  OFF,
}

interface Capability {
  performance: Subject<keyof typeof Mode>;
  performance$: Observable<keyof typeof Mode>;
}
