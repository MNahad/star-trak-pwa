import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SpaceComponent } from './space/space.component.js';
import { ObserverComponent } from './observer/observer.component.js';

const routes: Routes = [
  { path: '', redirectTo: '/space', pathMatch: 'full' },
  { path: 'space', component: SpaceComponent },
  { path: 'observer', component: ObserverComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
