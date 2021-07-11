import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { SatelliteService } from './satellite.service';
import { SensorService } from './sensor.service';
import { PageStateService } from './page-state.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Star Trak';
  isObserverDisabled = true;

  @ViewChild('loadingContainer', { static: true })
  private loadingContainer: ElementRef | undefined;

  private loadingImage = new Image();

  constructor(
    satelliteService: SatelliteService,
    sensorService: SensorService,
    pageStateService: PageStateService,
  ) {
    satelliteService.startTracker({
      observer: { lat_deg: 0, lon_deg: 0, alt_km: 0 },
      period: 1000,
    });

    const geoSensor$ = sensorService.getSensor$("geo");
    geoSensor$.pipe(
      filter(SensorService.isReading),
    ).subscribe(({ reading: [lat_deg, lon_deg, alt_km] }) => {
      satelliteService.updateObserver({ lat_deg, lon_deg, alt_km });
    });
    geoSensor$.pipe(
      filter(SensorService.isState),
    ).subscribe(({ state }) => {
      this.isObserverDisabled = !state;
    });

    pageStateService.go$.subscribe(ready => {
      this.reveal(ready);
    });
    this.loadingImage.onload = (() => {
      pageStateService.signalReady({ from: "main", state: true });
    });
  }

  ngOnInit(): void {
    this.loadingImage.src = "../assets/ISS062-E-148365.JPG";
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.backgroundImage =
        `url("${this.loadingImage.src}")`;
    }
  }

  private reveal(go: boolean): void {
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.display = go ? "none" : "grid";
    }
  }
}
