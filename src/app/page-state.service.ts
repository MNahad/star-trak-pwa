import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PageStateService {
  private pageReady = new Subject<boolean>();
  pageReady$ = this.pageReady.asObservable();

  ready(ready: boolean): void {
    this.pageReady.next(ready);
  }
}
