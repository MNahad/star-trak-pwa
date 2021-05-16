import { Component, ElementRef, ViewChild } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { PageStateService } from './page-state.service';
import { SatelliteService } from './satellite.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Star Trak';

  @ViewChild('loadingContainer', { static: true })
  private loadingContainer: ElementRef | undefined;

  constructor(
    private satelliteService: SatelliteService.SatelliteService,
    pageStateService: PageStateService,
    router: Router,
  ) {
    this.satelliteService.startTracker({
      observer: { lat_deg: 0, lon_deg: 0, alt_km: 0 },
      duration: 1000,
    });
    pageStateService.pageReady$.subscribe(ready => {
      if (this.loadingContainer) {
        this.loadingContainer.nativeElement.style.display = ready ? "none" : "grid";
      }
    });
    router.events.pipe(
      filter(event => event instanceof NavigationStart),
    ).subscribe(() => {
      if (this.loadingContainer) {
        this.loadingContainer.nativeElement.style.display = "grid";
      }
    });
  }
}
