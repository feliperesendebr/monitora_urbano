import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Alerta, Parque } from '../models/alerta.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  
  // Canal para coordenadas
  public localizacaoSelecionada$ = new Subject<{lat: number, lng: number}>();
  
  // Canal para controle de interface (Modo Seleção)
  public modoCapturaMapa$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Inicialização estrita com variáveis de ambiente
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // Busca assíncrona dos pontos para renderização no Leaflet
  async obterAlertas(): Promise<Alerta[]> {
    const { data, error } = await this.supabase
      .from('alertas_infraestrutura')
      .select('*');
    
    if (error) {
      console.error('Falha de segurança ou conexão na leitura:', error);
      throw error;
    }
    return data || [];
  }

  // Persistência acionada pelo usuário
  async inserirAlerta(alerta: Alerta): Promise<void> {
    const { error } = await this.supabase
      .from('alertas_infraestrutura')
      .insert([alerta]);
      
    if (error) {
      console.error('Falha de validação no banco de dados:', error);
      throw error;
    }
  }

  // MÉTODOS DE PARQUES
  async obterParques(): Promise<Parque[]> {
    const { data, error } = await this.supabase
      .from('parques')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  async inserirParque(parque: Parque): Promise<void> {
    const { error } = await this.supabase
      .from('parques')
      .insert([parque]);
    if (error) throw error;
  }
}
