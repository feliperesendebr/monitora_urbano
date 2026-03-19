import { Component, AfterViewInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { SupabaseService } from '../../core/services/supabase';
import { Alerta, Parque } from '../../core/models/alerta.model';

const CORES_ALERTA: Record<string, string> = {
  'buraco': '#ef4444',
  'falta_iluminacao': '#eab308',
  'calcada_irregular': '#f97316',
  'mato_alto': '#22c55e'
};

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div id="map" class="w-full h-full z-0" [ngClass]="{'cursor-crosshair': (supabaseService.modoCapturaMapa$ | async)}"></div>
    
    <!-- PAINEL LATERAL DE DIAGNÓSTICO (NOVO) -->
    <div *ngIf="parqueSelecionado" 
      class="absolute top-0 right-0 h-full w-full sm:w-80 bg-white z-[3000] shadow-2xl border-l border-gray-200 transform transition-transform duration-300 flex flex-col">
      
      <header class="bg-green-600 text-white p-6">
        <div class="flex justify-between items-start">
          <h2 class="text-xl font-bold leading-tight">🌳 {{ parqueSelecionado.nome }}</h2>
          <button (click)="parqueSelecionado = null" class="text-white hover:text-green-200 text-2xl">&times;</button>
        </div>
        <p class="text-[10px] uppercase font-bold tracking-widest mt-2 opacity-80">Diagnóstico de Zeladoria</p>
      </header>

      <div class="p-6 flex-1 overflow-y-auto space-y-6">
        <!-- Resumo Numérico -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span class="text-[10px] text-gray-400 font-bold uppercase">Total Alertas</span>
            <p class="text-2xl font-black text-gray-800">{{ statsParque.total }}</p>
          </div>
          <div class="bg-red-50 p-3 rounded-lg border border-red-100">
            <span class="text-[10px] text-red-400 font-bold uppercase">Nível Crítico</span>
            <p class="text-2xl font-black text-red-600">{{ statsParque.buracos + statsParque.iluminacao }}</p>
          </div>
        </div>

        <!-- Barras de Indicadores -->
        <div class="space-y-4">
          <h4 class="text-xs font-bold text-gray-400 uppercase">Indicadores por Categoria</h4>
          
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold"><span>Buracos na Via</span><span>{{ statsParque.buracos }}</span></div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div class="bg-red-500 h-full" [style.width.%]="(statsParque.buracos / (statsParque.total || 1)) * 100"></div>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold"><span>Falta de Iluminação</span><span>{{ statsParque.iluminacao }}</span></div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div class="bg-yellow-500 h-full" [style.width.%]="(statsParque.iluminacao / (statsParque.total || 1)) * 100"></div>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold"><span>Mato Alto / Abandono</span><span>{{ statsParque.mato }}</span></div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div class="bg-green-500 h-full" [style.width.%]="(statsParque.mato / (statsParque.total || 1)) * 100"></div>
            </div>
          </div>
        </div>

        <!-- Conclusão de Sênior -->
        <div class="p-4 rounded-xl border-2 border-dashed flex flex-col items-center text-center"
          [ngClass]="statsParque.total > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'">
          <span class="text-2xl mb-2">{{ statsParque.total > 0 ? '⚠️' : '✅' }}</span>
          <p class="text-xs font-bold" [ngClass]="statsParque.total > 0 ? 'text-red-700' : 'text-green-700'">
            {{ statsParque.total > 0 ? 'Esta área necessita de intervenção imediata da NOVACAP.' : 'Área com manutenção em dia.' }}
          </p>
        </div>
      </div>

      <footer class="p-6 bg-gray-50 border-t border-gray-100">
        <button class="w-full bg-gray-800 text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-900 transition-colors">
          Exportar Relatório PDF
        </button>
      </footer>
    </div>

    <!-- Painel de Rota Segura -->
    <div *ngIf="modoRotaAtivo && pontosRota.length >= 2" class="absolute bottom-24 left-4 z-[1000] bg-white p-3 rounded-lg shadow-xl border border-blue-100 max-w-[250px]">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-3 h-3 rounded-full animate-pulse" [ngClass]="rotaSegura ? 'bg-green-500' : 'bg-red-500'"></div>
        <span class="text-xs font-bold uppercase tracking-wider" [ngClass]="rotaSegura ? 'text-green-700' : 'text-red-700'">
          {{ rotaSegura ? 'Rota Segura' : 'Atenção: Risco Detectado' }}
        </span>
      </div>
    </div>

    <!-- Interface de Registro de Parque -->
    <div *ngIf="modoParqueAtivo" class="absolute top-24 left-4 z-[1000] bg-green-600 text-white p-4 rounded-lg shadow-2xl border-2 border-white max-w-[280px]">
      <h3 class="font-bold text-sm flex items-center gap-2">🌳 Modo Desenho de Parque</h3>
      <p class="text-[10px] mt-1 opacity-90">Clique nos cantos da área e finalize.</p>
      <div class="flex gap-2 mt-3">
        <button (click)="salvarParque()" [disabled]="pontosParque.length < 3" class="flex-1 bg-white text-green-700 text-[10px] font-bold py-2 rounded">Finalizar</button>
        <button (click)="alternarModoParque()" class="flex-1 bg-green-800 text-white text-[10px] font-bold py-2 rounded">Cancelar</button>
      </div>
    </div>

    <!-- Barra de Ferramentas Inferior -->
    <div class="absolute bottom-6 left-20 z-[1000] flex gap-3">
      <button (click)="alternarModoRota()" [class]="modoRotaAtivo ? 'bg-red-600' : 'bg-gray-800'" class="text-white p-4 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2">
        <span class="text-xs font-bold">{{ modoRotaAtivo ? 'Sair Rota' : '📍 Traçar Rota' }}</span>
      </button>
      <button (click)="alternarModoParque()" [class]="modoParqueAtivo ? 'bg-green-700' : 'bg-green-600'" class="text-white p-4 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2">
        <span class="text-xs font-bold">🌳 Registrar Parque</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .cursor-crosshair { cursor: crosshair !important; }
  `]
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  public map: L.Map | undefined;
  public supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private marcadorSelecao: L.Marker | undefined;
  private routingControl: any | undefined;
  
  // Estados
  modoRotaAtivo = false;
  modoParqueAtivo = false;
  rotaSegura = true;
  pontosRota: L.LatLng[] = [];
  pontosParque: L.LatLng[] = [];
  parqueSelecionado: Parque | null = null; // Parque em exibição no painel lateral
  statsParque = { total: 0, buracos: 0, iluminacao: 0, mato: 0 };
  private poligonoTemporario: L.Polygon | undefined;
  private alertasCache: Alerta[] = [];

  private criarIconeColorido(tipo: string): L.DivIcon {
    const cor = CORES_ALERTA[tipo] || '#3b82f6';
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${cor}; width: 26px; height: 26px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
  }

  ngAfterViewInit(): void {
    this.iniciarMapa();
    this.carregarDados();
    
    // TRUQUE DE SÊNIOR: Listener global para cliques em botões dentro de popups do Leaflet
    document.addEventListener('click', (event: any) => {
      if (event.target.id === 'btn-ver-detalhes') {
        const idParque = event.target.getAttribute('data-id');
        this.abrirPainelParque(idParque);
      }
    });
  }

  ngOnDestroy(): void { if (this.map) this.map.remove(); }

  private iniciarMapa(): void {
    this.map = L.map('map', { zoomControl: false }).setView([-15.8250, -48.0600], 13);
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      // Prioridade 1: Modo de Captura para o Formulário de Denúncia
      if (this.supabaseService.modoCapturaMapa$.value) {
        this.gerenciarCliqueAlerta(e.latlng);
        return;
      }

      // Prioridade 2: Modos de Edição (Parque ou Rota)
      if (this.modoParqueAtivo) {
        this.gerenciarCliqueParque(e.latlng);
      } else if (this.modoRotaAtivo) {
        this.gerenciarCliqueRota(e.latlng);
      }
      
      // Se não estiver em nenhum modo, o clique no mapa não faz NADA (protege a visualização)
    });
  }

  abrirPainelParque(id: string) {
    this.supabaseService.obterParques().then(parques => {
      const p = parques.find(x => x.id === id);
      if (p) {
        this.parqueSelecionado = p;
        this.statsParque = this.calcularStatsParque(p);
        this.cdr.detectChanges();
      }
    });
  }

  alternarModoParque() {
    this.modoParqueAtivo = !this.modoParqueAtivo;
    this.modoRotaAtivo = false;
    if (!this.modoParqueAtivo) this.limparDesenhoParque();
    this.cdr.detectChanges();
  }

  private gerenciarCliqueParque(latlng: L.LatLng) {
    this.pontosParque.push(latlng);
    if (this.poligonoTemporario) this.map?.removeLayer(this.poligonoTemporario);
    this.poligonoTemporario = L.polygon(this.pontosParque, { color: '#16a34a', fillOpacity: 0.3 }).addTo(this.map!);
    this.cdr.detectChanges();
  }

  async salvarParque() {
    const nome = prompt("Qual o nome desta Área/Parque?");
    if (!nome) return;
    const novoParque: Parque = { nome, geometria: this.pontosParque.map(p => ({ lat: p.lat, lng: p.lng })) };
    try {
      await this.supabaseService.inserirParque(novoParque);
      alert("Área registrada!");
      this.alternarModoParque();
      this.carregarDados();
    } catch (err) { alert("Erro ao salvar."); }
  }

  private limparDesenhoParque() {
    this.pontosParque = [];
    if (this.poligonoTemporario) this.map?.removeLayer(this.poligonoTemporario);
    this.poligonoTemporario = undefined;
  }

  private isAlertaNoParque(alerta: Alerta, geometria: {lat: number, lng: number}[]): boolean {
    const poly = L.polygon(geometria.map(g => [g.lat, g.lng] as L.LatLngExpression));
    return poly.getBounds().contains([alerta.latitude, alerta.longitude]);
  }

  alternarModoRota() {
    this.modoRotaAtivo = !this.modoRotaAtivo;
    this.modoParqueAtivo = false;
    if (!this.modoRotaAtivo) this.limparRota();
    this.cdr.detectChanges();
  }

  private gerenciarCliqueRota(latlng: L.LatLng) {
    if (this.pontosRota.length >= 2) this.limparRota();
    this.pontosRota.push(latlng);
    L.circleMarker(latlng, { radius: 8, color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(this.map!);
    if (this.pontosRota.length === 2) this.calcularRota();
    this.cdr.detectChanges();
  }

  private async calcularRota() {
    if (this.routingControl) this.map?.removeControl(this.routingControl);
    this.routingControl = (L as any).Routing.control({
      waypoints: this.pontosRota,
      router: (L as any).Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
      lineOptions: { styles: [{ color: '#3b82f6', weight: 6, opacity: 0.8 }] } as any,
      createMarker: () => null,
      addWaypoints: false, draggableWaypoints: false, show: false
    }).addTo(this.map);
    this.routingControl.on('routesfound', (e: any) => this.analisarSegurancaDaRota(e.routes[0].coordinates));
  }

  private analisarSegurancaDaRota(coordinates: any[]) {
    let risco = false;
    const criticos = this.alertasCache.filter(a => a.tipo_problema === 'buraco' || a.tipo_problema === 'falta_iluminacao');
    for (const c of coordinates) {
      for (const a of criticos) {
        if (this.map!.distance(c, [a.latitude, a.longitude]) < 150) { risco = true; break; }
      }
      if (risco) break;
    }
    this.rotaSegura = !risco;
    const cor = this.rotaSegura ? '#22c55e' : '#ef4444';
    this.map?.eachLayer((l: any) => { if (l instanceof L.Polyline && !(l instanceof L.Polygon) && !(l instanceof L.CircleMarker)) l.setStyle({ color: cor, weight: 8 }); });
    this.cdr.detectChanges();
  }

  async carregarDados() {
    if (!this.map) return;
    this.limparMapa();
    try {
      this.alertasCache = await this.supabaseService.obterAlertas();
      const parques = await this.supabaseService.obterParques();

      this.alertasCache.forEach(a => {
        const marcador = L.marker([a.latitude, a.longitude], { icon: this.criarIconeColorido(a.tipo_problema) });
        marcador.bindPopup(`<strong>${a.tipo_problema.toUpperCase()}</strong><br>${a.descricao}`);
        marcador.addTo(this.map!);
      });

      parques.forEach(p => {
        const stats = this.calcularStatsParque(p);
        const poly = L.polygon(p.geometria.map((g: any) => [g.lat, g.lng] as L.LatLngExpression), {
          color: stats.total > 0 ? '#dc2626' : '#16a34a',
          fillOpacity: 0.2,
          weight: 2
        }).addTo(this.map!);

        const popupHTML = `
          <div class="p-3 min-w-[200px]">
            <h4 class="font-bold text-gray-800 text-sm mb-1">🌳 ${p.nome}</h4>
            <p class="text-[11px] text-gray-500 mb-3">${stats.total} alertas ativos na área</p>
            <button id="btn-ver-detalhes" data-id="${p.id}" 
              class="w-full bg-green-600 text-white text-[10px] font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-all shadow-sm active:scale-95">
              Ver Diagnóstico Completo
            </button>
          </div>
        `;

        poly.on('click', (e: L.LeafletMouseEvent) => {
          if (this.supabaseService.modoCapturaMapa$.value) {
            L.DomEvent.stopPropagation(e);
            this.gerenciarCliqueAlerta(e.latlng);
          } else {
            L.popup().setLatLng(e.latlng).setContent(popupHTML).openOn(this.map!);
          }
        });
      });
    } catch (err) { console.error(err); }
  }

  private calcularStatsParque(parque: Parque) {
    const internos = this.alertasCache.filter(a => this.isAlertaNoParque(a, parque.geometria));
    return {
      total: internos.length,
      buracos: internos.filter(a => a.tipo_problema === 'buraco').length,
      iluminacao: internos.filter(a => a.tipo_problema === 'falta_iluminacao').length,
      mato: internos.filter(a => a.tipo_problema === 'mato_alto').length
    };
  }

  private gerenciarCliqueAlerta(latlng: L.LatLng) {
    if (this.marcadorSelecao) this.marcadorSelecao.setLatLng(latlng);
    else this.marcadorSelecao = L.marker(latlng, { icon: this.criarIconeColorido('default') }).addTo(this.map!);
    this.supabaseService.localizacaoSelecionada$.next({ lat: latlng.lat, lng: latlng.lng });
  }

  private limparMapa() {
    this.map?.eachLayer((l) => { if (l instanceof L.Marker || l instanceof L.Polygon) this.map?.removeLayer(l); });
  }

  private limparRota() {
    this.pontosRota = [];
    this.rotaSegura = true;
    if (this.routingControl) { this.map?.removeControl(this.routingControl); this.routingControl = undefined; }
    this.map?.eachLayer((l) => { if (l instanceof L.CircleMarker) this.map?.removeLayer(l); });
    this.cdr.detectChanges();
  }

  recarregarPontos() { this.carregarDados(); }
}
