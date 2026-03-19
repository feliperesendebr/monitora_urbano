import { Component } from '@angular/core';
import { MapaComponent } from './features/mapa/mapa';
import { FormularioAlertaComponent } from './features/formulario-alerta/formulario-alerta';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapaComponent, FormularioAlertaComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App { }
