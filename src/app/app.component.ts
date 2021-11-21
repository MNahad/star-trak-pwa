import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { SatelliteService } from './satellite.service';
import { PageStateService } from './page-state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Star Trak';

  @ViewChild('loadingContainer', { static: true })
  private loadingContainer: ElementRef<HTMLDivElement> | undefined;
  private loadingImage = new Image();
  isLoading = true;

  constructor(
    private pageStateService: PageStateService,
    satelliteService: SatelliteService,
  ) {
    satelliteService.startTracker({
      observer: { lat_deg: 0, lon_deg: 0, alt_km: 0 },
      period: 1000,
    });
    pageStateService.go$.subscribe(ready => {
      this.reveal(ready);
    });
    this.loadingImage.onload = (() => {
      this.isLoading = false;
    });
  }

  ngOnInit(): void {
    this.loadingImage.src = "../assets/ISS062-E-148365.JPG";
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.backgroundImage =
        `url("${this.loadingImage.src}")`;
    }
  }

  onUserAccept(): void {
    this.pageStateService.signalReady({ from: "main", state: true });
  }

  private reveal(go: boolean): void {
    if (this.loadingContainer) {
      this.loadingContainer.nativeElement.style.display = go ? "none" : "grid";
    }
  }
}
