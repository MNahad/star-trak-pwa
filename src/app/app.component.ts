import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PageStateService } from './page-state.service';
import { SatelliteService } from './satellite.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Star Trak';

  @ViewChild('loadingContainer', { static: true })
  private loadingContainer: ElementRef | undefined;

  private loadingImage = new Image();

  constructor(
    private satelliteService: SatelliteService.SatelliteService,
    private pageStateService: PageStateService,
  ) {
    this.satelliteService.startTracker({
      observer: { lat_deg: 0, lon_deg: 0, alt_km: 0 },
      duration: 1000,
    });
  }

  ngOnInit(): void {
    this.loadingImage.onload = (() => {
      this.pageStateService.signalReady("main", true);
    });
    this.loadingImage.src = "../assets/ISS062-E-148365.JPG";
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.backgroundImage =
        `url("${this.loadingImage.src}")`;
    }
    this.pageStateService.allClear$.subscribe(ready => {
      this.reveal(ready);
    });
  }

  private reveal(go: boolean): void {
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.display = go ? "none" : "grid";
    }
  }
}
