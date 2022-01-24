import { Injectable } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PageStateService {
  private pageState: Record<string, boolean> = {
    main: false,
    page: false,
  };
  private go = new Subject<boolean>();
  public go$ = this.go.asObservable();

  constructor(router: Router) {
    router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => {
        this.signalReady({ from: 'page', state: false });
      });
    setInterval(() => this.signalGo(), 1000);
  }

  signalReady({ from, state }: ReadySignal): void {
    this.pageState[from] = state;
  }

  private signalGo(): void {
    if (Object.values(this.pageState).every(Boolean)) {
      this.go.next(true);
    } else {
      this.go.next(false);
    }
  }
}

interface ReadySignal {
  from: 'main' | 'page';
  state: boolean;
}
