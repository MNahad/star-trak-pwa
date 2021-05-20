import { Injectable } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PageStateService {
  private pageState: Record<string, boolean> = {
    main: false,
    page: false,
  };
  private pageReady = new Subject<{ from: "main" | "page"; state: boolean }>();
  private allClear = new Subject<boolean>();
  public pageReady$ = this.pageReady.asObservable();
  public allClear$ = this.allClear.asObservable();

  constructor(router: Router) {
    this.pageReady$.subscribe(({ from, state }) => {
      this.pageState[from] = state;
      if (Object.values(this.pageState).every(Boolean)) {
        this.allClear.next(true);
      } else {
        this.allClear.next(false);
      }
    });
    router.events.pipe(
      filter(event => event instanceof NavigationStart),
    ).subscribe(() => {
      this.allClear.next(false);
    });
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      this.allClear.next(true);
    });
  }

  signalReady(from: "main" | "page", state: boolean): void {
    this.pageReady.next({ from, state });
  }
}
