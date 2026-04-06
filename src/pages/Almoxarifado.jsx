import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Almoxarifado({ nome, onLogout }) {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('Pendente'); // Pendente ou Entregue
  const [loading, setLoading] = useState(false);

  const buscarPedidos = async () => {
    const { data, error } = await supabase
      .from('pedidos_pecas')
      .select(`
        *,
        servicos (
          trator_nome,
          numero_os
        )
      `)
      .order('criado_em', { ascending: false });

    if (!error) setPedidos(data);
  };

  useEffect(() => {
    buscarPedidos();
  }, []);

  const darBaixaNoItem = async (id, servicoId, itemNome) => {
    if (loading) return; // Evita cliques duplos
    setLoading(true);

    try {
      // 1. Atualiza o status na tabela de pedidos
      const { error: updateError } = await supabase
        .from('pedidos_pecas')
        .update({ 
          status: 'Entregue',
          entregue_por: nome,
          entregue_em: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Registrar no histórico da OS que a peça foi entregue
      const { error: historyError } = await supabase.from('historico_servicos').insert([
        { 
          servico_id: servicoId, 
          acao: `ALMOXARIFADO: Item [${itemNome}] entregue para a oficina.`, 
          usuario: nome 
        }
      ]);

      if (historyError) console.error("Erro ao registrar histórico:", historyError);

      // 3. Atualiza a lista localmente para refletir a mudança imediatamente
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: 'Entregue', entregue_por: nome } : p));
      
      alert(`Baixa do item "${itemNome}" realizada!`);
      
    } catch (err) {
      console.error("Erro na operação:", err);
      alert("Falha ao dar baixa. Verifique sua conexão ou permissões no Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const pedidosFiltrados = pedidos.filter(p => p.status === filtro);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-black text-orange-500 italic uppercase">Almoxarifado Engetractor</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase">Controle de Saída de Peças e Materiais</p>
          </div>
          <button onClick={onLogout} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-950 transition-all text-white">SAIR</button>
        </header>

        {/* SELETOR DE STATUS */}
        <div className="flex gap-4 mb-8 bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit">
          <button 
            onClick={() => setFiltro('Pendente')}
            className={`px-6 py-2 rounded-lg font-black text-xs uppercase transition-all ${filtro === 'Pendente' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            ⏳ Pendentes
          </button>
          <button 
            onClick={() => setFiltro('Entregue')}
            className={`px-6 py-2 rounded-lg font-black text-xs uppercase transition-all ${filtro === 'Entregue' ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            ✅ Entregues
          </button>
        </div>

        <div className="space-y-4">
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-zinc-900 rounded-3xl">
              <p className="text-zinc-600 font-bold uppercase italic">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => (
              <div key={pedido.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 hover:border-orange-500/50 transition-all">
                <div className="flex-1 text-center md:text-left">
                  <span className="text-[10px] bg-orange-600/20 text-orange-500 px-2 py-0.5 rounded font-black uppercase mb-2 inline-block">
                    OS: {pedido.servicos?.numero_os || 'S/N'}
                  </span>
                  <h3 className="text-xl font-black uppercase italic text-white">{pedido.item_nome}</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Máquina: {pedido.servicos?.trator_nome}</p>
                  <p className="text-zinc-600 text-[10px] mt-2 italic">Solicitado por: {pedido.solicitado_por} em {new Date(pedido.criado_em).toLocaleString('pt-BR')}</p>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2">
                  {pedido.status === 'Pendente' ? (
                    <button 
                      disabled={loading}
                      onClick={() => darBaixaNoItem(pedido.id, pedido.servico_id, pedido.item_nome)}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-3 rounded-xl uppercase text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Processando...' : 'Dar Baixa / Entregar'}
                    </button>
                  ) : (
                    <div className="text-right">
                      <span className="text-green-500 font-black text-xs uppercase">Entregue ✓</span>
                      <p className="text-zinc-600 text-[9px] uppercase">Por: {pedido.entregue_por}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}