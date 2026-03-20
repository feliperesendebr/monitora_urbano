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
    
    <!-- LOADING BAR (TOP) -->
    <div *ngIf="carregando" class="absolute top-0 left-0 w-full h-1 bg-blue-100 z-[5000] overflow-hidden">
      <div class="h-full bg-blue-600 animate-loading-bar"></div>
    </div>

    <!-- PAINEL LATERAL DE DIAGNÓSTICO -->
    <div *ngIf="parqueSelecionado" id="painelDiagnostico"
      class="absolute top-0 right-0 h-full w-full sm:w-80 bg-white z-[3000] shadow-2xl border-l border-gray-200 transform transition-transform duration-300 flex flex-col pointer-events-auto">
      
      <header class="bg-green-600 text-white p-6 relative">
        <div *ngIf="carregandoPainel" class="absolute inset-0 bg-green-600/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
           <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="flex justify-between items-start">
          <h2 class="text-xl font-bold leading-tight">🌳 {{ parqueSelecionado.nome }}</h2>
          <button (click)="parqueSelecionado = null" class="text-white hover:text-green-200 text-2xl">&times;</button>
        </div>
        <p class="text-[10px] uppercase font-bold tracking-widest mt-2 opacity-80">Diagnóstico de Zeladoria</p>
      </header>

      <div class="p-6 flex-1 overflow-y-auto space-y-6">
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

        <div class="space-y-4">
          <h4 class="text-xs font-bold text-gray-400 uppercase">Indicadores</h4>
          <div *ngFor="let item of [
            {label: 'Buracos na Via', val: statsParque.buracos, cor: 'bg-red-500'},
            {label: 'Falta de Iluminação', val: statsParque.iluminacao, cor: 'bg-yellow-500'},
            {label: 'Mato Alto', val: statsParque.mato, cor: 'bg-green-500'}
          ]" class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold"><span>{{item.label}}</span><span>{{item.val}}</span></div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div [class]="item.cor + ' h-full'" [style.width.%]="(item.val / (statsParque.total || 1)) * 100"></div>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-xl border-2 border-dashed flex flex-col items-center text-center"
          [ngClass]="statsParque.total > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'">
          <span class="text-2xl mb-2">{{ statsParque.total > 0 ? '⚠️' : '✅' }}</span>
          <p class="text-xs font-bold" [ngClass]="statsParque.total > 0 ? 'text-red-700' : 'text-green-700'">
            {{ statsParque.total > 0 ? 'Esta área necessita de intervenção imediata.' : 'Área com manutenção em dia.' }}
          </p>
        </div>
      </div>

      <footer class="p-6 bg-gray-50 border-t border-gray-100">
        <button (click)="exportarPDF()" [disabled]="carregandoExport" class="w-full bg-gray-800 text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-900 transition-colors flex justify-center items-center gap-2 disabled:opacity-70">
          <div *ngIf="carregandoExport" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          {{ carregandoExport ? 'Processando PDF...' : 'Gerar Relatório Profissional' }}
        </button>
      </footer>
    </div>

    <!-- Painel de Rota Segura -->
    <div *ngIf="modoRotaAtivo && pontosRota.length >= 2" class="absolute bottom-24 left-4 z-[1000] bg-white p-3 rounded-lg shadow-xl border border-blue-100 max-w-[250px] pointer-events-auto">
      <div class="flex items-center gap-2 mb-2">
        <div *ngIf="carregandoRota" class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div *ngIf="!carregandoRota" class="w-3 h-3 rounded-full animate-pulse" [ngClass]="rotaSegura ? 'bg-green-500' : 'bg-red-500'"></div>
        <span class="text-xs font-bold uppercase tracking-wider" [ngClass]="rotaSegura ? 'text-green-700' : 'text-red-700'">
          {{ carregandoRota ? 'Calculando Riscos...' : (rotaSegura ? 'Rota Segura' : 'Atenção: Risco Detectado') }}
        </span>
      </div>
    </div>

    <!-- Interface de Registro de Parque -->
    <div *ngIf="modoParqueAtivo" class="absolute top-24 left-4 z-[1000] bg-green-600 text-white p-4 rounded-lg shadow-2xl border-2 border-white max-w-[280px] pointer-events-auto">
      <h3 class="font-bold text-sm flex items-center gap-2">🌳 Modo Desenho</h3>
      <p class="text-[10px] mt-1 opacity-90">Defina os limites no mapa.</p>
      <div class="flex gap-2 mt-3">
        <button (click)="salvarParque()" [disabled]="pontosParque.length < 3 || carregando" class="flex-1 bg-white text-green-700 text-[10px] font-bold py-2 rounded flex justify-center items-center gap-1">
           <div *ngIf="carregando" class="w-3 h-3 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
           Salvar
        </button>
        <button (click)="alternarModoParque()" class="flex-1 bg-green-800 text-white text-[10px] font-bold py-2 rounded">Sair</button>
      </div>
    </div>

    <!-- Barra de Ferramentas Inferior -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex gap-2 sm:gap-3 w-[calc(100%-2rem)] sm:w-auto justify-center pointer-events-auto">
      <button (click)="alternarModoRota()" 
        [class]="modoRotaAtivo ? 'bg-red-600' : 'bg-gray-800'" 
        class="text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2 min-w-fit border-2 border-white/20">
        <span class="text-xs font-bold whitespace-nowrap">{{ modoRotaAtivo ? 'Sair Rota' : '📍 Rota' }}</span>
      </button>
      <button (click)="alternarModoParque()" 
        [class]="modoParqueAtivo ? 'bg-green-700' : 'bg-green-600'" 
        class="text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2 min-w-fit border-2 border-white/20">
        <span class="text-xs font-bold whitespace-nowrap">🌳 Áreas</span>
      </button>
    </div>
  `,
  styles: [`
    .cursor-crosshair { cursor: crosshair !important; }
    #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
    
    @keyframes loading-bar {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .animate-loading-bar {
      width: 100%;
      animation: loading-bar 1.5s infinite linear;
    }
  `]
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  public map: L.Map | undefined;
  public supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private marcadorSelecao: L.Marker | undefined;
  private routingControl: any | undefined;
  
  // Estados de Carregamento
  carregando = false;
  carregandoPainel = false;
  carregandoExport = false;
  carregandoRota = false;

  modoRotaAtivo = false;
  modoParqueAtivo = false;
  rotaSegura = true;
  pontosRota: L.LatLng[] = [];
  pontosParque: L.LatLng[] = [];
  parqueSelecionado: Parque | null = null;
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
    setTimeout(() => {
      this.iniciarMapa();
      this.carregarDados();
    }, 100);

    document.addEventListener('click', (event: any) => {
      if (event.target.id === 'btn-ver-detalhes') {
        const idParque = event.target.getAttribute('data-id');
        this.abrirPainelParque(idParque);
      }
    });
  }

  ngOnDestroy(): void { if (this.map) this.map.remove(); }

  private iniciarMapa(): void {
    if (this.map) return;
    this.map = L.map('map', { zoomControl: false }).setView([-15.8250, -48.0600], 13);
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { 
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors' 
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.supabaseService.modoCapturaMapa$.value) {
        this.gerenciarCliqueAlerta(e.latlng);
        return;
      }
      if (this.modoParqueAtivo) this.gerenciarCliqueParque(e.latlng);
      else if (this.modoRotaAtivo) this.gerenciarCliqueRota(e.latlng);
    });
    setTimeout(() => this.map?.invalidateSize(), 500);
  }

  async abrirPainelParque(id: string) {
    this.carregandoPainel = true;
    this.cdr.detectChanges();
    try {
      const parques = await this.supabaseService.obterParques();
      const p = parques.find(x => x.id === id);
      if (p) {
        this.parqueSelecionado = p;
        this.statsParque = this.calcularStatsParque(p);
      }
    } finally {
      this.carregandoPainel = false;
      this.cdr.detectChanges();
    }
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
    const nome = prompt("Nome da Área?");
    if (!nome) return;
    this.carregando = true;
    const novoParque: Parque = { nome, geometria: this.pontosParque.map(p => ({ lat: p.lat, lng: p.lng })) };
    try {
      await this.supabaseService.inserirParque(novoParque);
      this.alternarModoParque();
      await this.carregarDados();
    } catch (err) { alert("Erro ao salvar."); }
    finally { this.carregando = false; this.cdr.detectChanges(); }
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
    this.carregandoRota = true;
    this.cdr.detectChanges();

    this.routingControl = (L as any).Routing.control({
      waypoints: this.pontosRota,
      router: (L as any).Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
      lineOptions: { styles: [{ color: '#3b82f6', weight: 6, opacity: 0.8 }] } as any,
      createMarker: () => null,
      addWaypoints: false, draggableWaypoints: false, show: false
    }).addTo(this.map);
    
    this.routingControl.on('routesfound', (e: any) => {
      this.analisarSegurancaDaRota(e.routes[0].coordinates);
      this.carregandoRota = false;
      this.cdr.detectChanges();
    });
    
    this.routingControl.on('routingerror', () => {
      this.carregandoRota = false;
      this.cdr.detectChanges();
    });
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
    this.carregando = true;
    this.cdr.detectChanges();
    this.limparMapa();
    try {
      this.alertasCache = await this.supabaseService.obterAlertas();
      const parques = await this.supabaseService.obterParques();
      
      this.alertasCache.forEach(a => {
        const m = L.marker([a.latitude, a.longitude], { icon: this.criarIconeColorido(a.tipo_problema) });
        m.bindPopup(`<strong>${a.tipo_problema.toUpperCase()}</strong><br>${a.descricao}`);
        m.addTo(this.map!);
      });

      parques.forEach(p => {
        const stats = this.calcularStatsParque(p);
        const poly = L.polygon(p.geometria.map((g: any) => [g.lat, g.lng] as L.LatLngExpression), {
          color: stats.total > 0 ? '#dc2626' : '#16a34a', fillOpacity: 0.2, weight: 2
        }).addTo(this.map!);
        
        const popupHTML = `<div class="p-3 min-w-[200px]"><h4 class="font-bold text-sm mb-1">🌳 ${p.nome}</h4><p class="text-[11px] text-gray-500 mb-3">${stats.total} alertas ativos</p><button id="btn-ver-detalhes" data-id="${p.id}" class="w-full bg-green-600 text-white text-[10px] font-bold py-2 px-4 rounded hover:bg-green-700">Ver Diagnóstico</button></div>`;
        
        poly.on('click', (e: L.LeafletMouseEvent) => {
          if (this.supabaseService.modoCapturaMapa$.value) { L.DomEvent.stopPropagation(e); this.gerenciarCliqueAlerta(e.latlng); }
          else { L.popup().setLatLng(e.latlng).setContent(popupHTML).openOn(this.map!); }
        });
      });
    } catch (err) { console.error(err); }
    finally { this.carregando = false; this.cdr.detectChanges(); }
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

  private limparMapa() { this.map?.eachLayer((l) => { if (l instanceof L.Marker || l instanceof L.Polygon) this.map?.removeLayer(l); }); }
  private limparRota() {
    this.pontosRota = []; this.rotaSegura = true;
    if (this.routingControl) { this.map?.removeControl(this.routingControl); this.routingControl = undefined; }
    this.map?.eachLayer((l) => { if (l instanceof L.CircleMarker) this.map?.removeLayer(l); });
    this.cdr.detectChanges();
  }

  recarregarPontos() { this.carregarDados(); }

  async exportarPDF() {
    if (!this.parqueSelecionado) return;
    this.carregandoExport = true;
    this.cdr.detectChanges();
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.padding = '40px';
      container.style.backgroundColor = '#ffffff';
      container.style.fontFamily = 'Arial, sans-serif';
      container.style.color = '#333';

      const dataAtual = new Date().toLocaleString('pt-BR');
      const percentBuracos = (this.statsParque.buracos / (this.statsParque.total || 1)) * 100;
      const percentLuz = (this.statsParque.iluminacao / (this.statsParque.total || 1)) * 100;
      const percentMato = (this.statsParque.mato / (this.statsParque.total || 1)) * 100;

      container.innerHTML = `
        <div style="border-bottom: 4px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; color: #16a34a; font-size: 28px;">MONITORA URBANO</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Relatório de Diagnóstico de Zeladoria Pública</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 10px; color: #999;">EMITIDO EM</p>
            <p style="margin: 0; font-size: 12px; font-weight: bold;">${dataAtual}</p>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0; font-size: 24px; color: #1e293b;">🌳 ÁREA: ${this.parqueSelecionado.nome}</h2>
          <p style="margin: 10px 0 0 0; color: #64748b; line-height: 1.6;">Este documento apresenta a análise técnica consolidada dos alertas de infraestrutura registrados pela comunidade na região delimitada.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; flex: 1;">
            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Alertas Totais</p>
            <p style="margin: 10px 0 0 0; font-size: 42px; font-weight: 900; color: #1e293b;">${this.statsParque.total}</p>
          </div>
          <div style="background-color: ${this.statsParque.total > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid ${this.statsParque.total > 0 ? '#fee2e2' : '#dcfce7'}; flex: 1;">
            <p style="margin: 0; font-size: 12px; color: ${this.statsParque.total > 0 ? '#b91c1c' : '#15803d'}; text-transform: uppercase; font-weight: bold;">Status de Manutenção</p>
            <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold; color: ${this.statsParque.total > 0 ? '#b91c1c' : '#15803d'};">
              ${this.statsParque.total > 0 ? 'INTERVENÇÃO NECESSÁRIA' : 'MANUTENÇÃO EM DIA'}
            </p>
          </div>
        </div>

        <h3 style="border-left: 5px solid #3b82f6; padding-left: 15px; margin-bottom: 25px; color: #1e293b;">INDICADORES POR CATEGORIA</h3>
        
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; font-size: 14px;">
            <span>Buracos na Via / Ciclovia</span>
            <span>${this.statsParque.buracos} ocorrências</span>
          </div>
          <div style="width: 100%; height: 12px; border-radius: 6px; overflow: hidden; background: #e2e8f0;">
            <div style="width: ${percentBuracos}%; background: #ef4444; height: 100%;"></div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; font-size: 14px;">
            <span>Falta de Iluminação Pública</span>
            <span>${this.statsParque.iluminacao} ocorrências</span>
          </div>
          <div style="width: 100%; height: 12px; border-radius: 6px; overflow: hidden; background: #e2e8f0;">
            <div style="width: ${percentLuz}%; background: #eab308; height: 100%;"></div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; font-size: 14px;">
            <span>Mato Alto / Abandono de Área</span>
            <span>${this.statsParque.mato} ocorrências</span>
          </div>
          <div style="width: 100%; height: 12px; border-radius: 6px; overflow: hidden; background: #e2e8f0;">
            <div style="width: ${percentMato}%; background: #22c55e; height: 100%;"></div>
          </div>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px;">
          <p>Documento gerado automaticamente pelo Sistema Monitora Urbano - Brasília/DF</p>
        </div>
      `;

      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`MonitoraUrbano_${this.parqueSelecionado.nome.replace(/\s+/g, '_')}.pdf`);
      document.body.removeChild(container);
    } catch (err) {
      console.error("Erro PDF:", err);
      alert("Falha ao gerar relatório.");
    } finally {
      this.carregandoExport = false;
      this.cdr.detectChanges();
    }
  }
}
