import { ChangeDetectorRef, Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase';
import { Alerta } from '../../core/models/alerta.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-formulario-alerta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './formulario-alerta.html'
})
export class FormularioAlertaComponent implements OnInit, OnDestroy {
  @Output() alertaRegistrado = new EventEmitter<void>();
  
  private fb = inject(FormBuilder);
  public supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private subscricaoMapa: Subscription | undefined;

  formulario: FormGroup;
  modalAberto = false;
  modoCapturaManual = false; // Novo estado
  buscandoGps = false;
  erroGps = '';

  constructor() {
    this.formulario = this.fb.group({
      tipo_problema: ['', Validators.required],
      descricao: ['', [Validators.maxLength(255)]],
      latitude: [null, Validators.required],
      longitude: [null, Validators.required]
    });
  }

  toggleModal() {
    if (this.modalAberto) {
      this.formulario.reset();
      this.modoCapturaManual = false;
      this.supabase.modoCapturaMapa$.next(false);
    }
    this.modalAberto = !this.modalAberto;
    this.cdr.detectChanges();
  }

  ativarCapturaManual() {
    this.modoCapturaManual = true;
    this.supabase.modoCapturaMapa$.next(true); // Avisa o mapa para ficar em prontidão
    this.cdr.detectChanges();
  }

  // Método específico para abrir via mapa sem risco de toggle/reset
  abrirViaMapa(lat: number, lng: number) {
    this.formulario.patchValue({
      latitude: lat,
      longitude: lng
    });
    this.modalAberto = true;
    this.modoCapturaManual = false; // Restaura o formulário após capturar
    this.supabase.modoCapturaMapa$.next(false);
    
    this.formulario.get('latitude')?.updateValueAndValidity();
    this.formulario.get('longitude')?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    // Escuta cliques no mapa para preencher coordenadas automaticamente
    this.subscricaoMapa = this.supabase.localizacaoSelecionada$.subscribe(coords => {
      // SÓ processa se o modo de captura estiver ligado globalmente
      if (this.supabase.modoCapturaMapa$.value) {
        this.abrirViaMapa(coords.lat, coords.lng);
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe para evitar memory leak (Dispose)
    if (this.subscricaoMapa) {
      this.subscricaoMapa.unsubscribe();
    }
  }

  capturarLocalizacao() {
    if (!navigator.geolocation) {
      this.erroGps = 'Geolocalização não suportada pelo navegador.';
      return;
    }

    this.buscandoGps = true;
    this.erroGps = '';
    this.cdr.detectChanges(); // Garante que o spinner/botão desabilitado apareça

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        // Timeout de 0ms para empurrar a atualização para o próximo ciclo de renderização (Resolve NG0100)
        setTimeout(() => {
          this.formulario.patchValue({
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude
          });
          this.buscandoGps = false;
          this.formulario.get('latitude')?.updateValueAndValidity();
          this.formulario.get('longitude')?.updateValueAndValidity();
          this.cdr.detectChanges();
        }, 0);
      },
      (erro) => {
        setTimeout(() => {
          this.buscandoGps = false;
          this.erroGps = 'Permissão de GPS negada ou falha na leitura.';
          this.cdr.detectChanges();
        }, 0);
        console.error(erro);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async submeter() {
    if (this.formulario.invalid) return;

    try {
      const payload: Alerta = this.formulario.value;
      await this.supabase.inserirAlerta(payload);
      
      this.toggleModal();
      // Notifica o componente pai para atualizar o mapa
      this.alertaRegistrado.emit(); 
      alert('Alerta registrado com sucesso!');
    } catch (error) {
      alert('Erro crítico ao salvar no banco de dados.');
    }
  }
}
