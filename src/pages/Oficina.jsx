import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/logo.png';

export default function Oficina({ nome, onLogout }) {
  const [servicos, setServicos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false); // NOVO: Controle da lixeira

  const buscarServicos = async () => {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .order('criado_em', { ascending: false });
    if (!error) setServicos(data);
  };

  useEffect(() => {
    buscarServicos();
  }, []);

  const registrarLog = async (servicoId, acao) => {
    await supabase.from('historico_servicos').insert([
      { servico_id: servicoId, acao: acao, usuario: nome }
    ]);
  };

  // NOVO: Função para salvar observações extras (RH)
  const salvarObsExtra = async (id, texto) => {
    const { error } = await supabase
      .from('servicos')
      .update({ observacoes_extras: texto })
      .eq('id', id);
    
    if (!error) {
      buscarServicos(); // Atualiza silenciosamente
    }
  };

  const fazerUploadEvidencia = async (e, servicoId, tipo) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    setUploading(servicoId);
    const nomeArquivo = `${servicoId}/${tipo}_${Date.now()}`;

    try {
      const { data, error } = await supabase.storage
        .from('fotos-checkin') 
        .upload(nomeArquivo, arquivo);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('fotos-checkin')
        .getPublicUrl(nomeArquivo);

      const { error: dbError } = await supabase
        .from('evidencias_servico')
        .insert([{ 
          servico_id: servicoId, 
          foto_url: publicUrl, 
          tipo: tipo,
          descricao: `Foto de ${tipo} enviada por ${nome}`
        }]);

      if (!dbError) {
        await registrarLog(servicoId, `Adicionou foto de evidência: ${tipo.toUpperCase()}`);
        alert(`Foto de ${tipo} salva com sucesso!`);
      }
    } catch (err) {
      console.error("Erro no upload:", err);
      alert("Erro ao subir imagem: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  const atualizarStatusGeral = async (id, novoStatus) => {
    setLoading(true);
    const { error } = await supabase
      .from('servicos')
      .update({ status: novoStatus })
      .eq('id', id);
    
    if (!error) {
      const acaoLog = novoStatus === 'Em Andamento' ? 'Iniciou/Reabriu o serviço' : `Alterou status para: ${novoStatus}`;
      await registrarLog(id, acaoLog);
      buscarServicos();
    }
    setLoading(false);
  };

  const alternarItemServico = async (servicoCompleto, indexItem) => {
    try {
      const tarefas = JSON.parse(servicoCompleto.servico_descricao);
      const estaConcluindo = !tarefas[indexItem].concluida;

      tarefas[indexItem].concluida = estaConcluindo;
      tarefas[indexItem].finalizado_por = estaConcluindo ? nome : null;
      tarefas[indexItem].finalizado_em = estaConcluindo ? new Date().toLocaleString('pt-BR') : null;

      const { error } = await supabase
        .from('servicos')
        .update({ servico_descricao: JSON.stringify(tarefas) })
        .eq('id', servicoCompleto.id);

      if (!error) {
        const mensagemLog = estaConcluindo 
          ? `Finalizou a tarefa: ${tarefas[indexItem].tarefa}` 
          : `Reabriu a tarefa: ${tarefas[indexItem].tarefa}`;
        
        await registrarLog(servicoCompleto.id, mensagemLog);
        buscarServicos();
      }
    } catch (e) {
      console.log("Formato antigo");
    }
  };

  // Filtros de busca
  const filtrar = (s) => {
    const termo = busca.toLowerCase();
    return (
      s.trator_nome.toLowerCase().includes(termo) || 
      s.marca.toLowerCase().includes(termo) ||
      (s.numero_os || '').toLowerCase().includes(termo)
    );
  };

  const servicosAtivos = servicos.filter(s => filtrar(s) && s.status !== 'Concluído');
  const servicosFinalizados = servicos.filter(s => filtrar(s) && s.status === 'Concluído');

  const renderizarChecklist = (s) => {
    try {
      const tarefas = JSON.parse(s.servico_descricao);
      return tarefas.map((item, i) => (
        <div 
          key={i} 
          onClick={() => s.status !== 'Concluído' && alternarItemServico(s, i)}
          className={`flex flex-col gap-1.5 p-4 rounded-2xl transition-all border shadow-sm ${
            item.concluida 
            ? 'bg-green-950/20 border-green-800/40 text-green-500' 
            : 'bg-zinc-950 border-zinc-800/60 text-zinc-300 hover:border-tractor-yellow active:scale-95 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
              item.concluida ? 'bg-green-600 border-green-600' : 'border-zinc-700 bg-zinc-900'
            }`}>
              {item.concluida && <span className="text-white font-bold text-xs">✓</span>}
            </div>
            <span className={`text-sm font-black uppercase italic ${item.concluida ? 'line-through opacity-40' : ''}`}>
              {item.tarefa}
            </span>
          </div>
          {item.concluida && item.finalizado_por && (
            <div className="pl-9 text-[8px] italic opacity-60 flex flex-wrap gap-2 uppercase font-black tracking-widest text-zinc-400">
              <span>👤 {item.finalizado_por}</span>
              <span>⏰ {item.finalizado_em}</span>
            </div>
          )}
        </div>
      ));
    } catch (e) {
      return s.servico_descricao.split(' | ').map((item, i) => (
        <div key={i} className="text-sm text-zinc-400 flex items-center gap-2 p-1 font-bold uppercase italic">
          <span className="text-tractor-yellow text-lg">›</span> {item}
        </div>
      ));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      <header className="bg-zinc-900/80 border-b border-zinc-800 shadow-2xl sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Engetractor Logo" className="h-12 w-auto object-contain" />
            <div className="border-l border-zinc-700 pl-4">
              <h1 className="text-xl font-black text-white italic uppercase tracking-wider leading-none">Oficina</h1>
              <p className="text-zinc-500 text-[9px] font-black uppercase mt-1 tracking-widest">{nome}</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-xl font-black text-[10px] hover:bg-red-950 transition-all text-white uppercase tracking-widest">SAIR</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-tractor-yellow transition-colors">🔍</span>
            <input 
              type="text" 
              placeholder="Pesquise por Trator, Marca ou OS..." 
              className="w-full bg-zinc-900 border border-zinc-800 p-4.5 pl-12 rounded-2xl outline-none focus:border-tractor-yellow transition-all shadow-inner text-white placeholder:text-zinc-700"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* LISTA ATIVA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {servicosAtivos.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-zinc-700 italic font-black uppercase tracking-widest text-sm">Nenhum serviço pendente...</p>
            </div>
          ) : (
            servicosAtivos.map((s) => (
              <div key={s.id} className={`bg-zinc-900 p-6 rounded-3xl border transition-all flex flex-col gap-5 shadow-2xl ${s.status === 'Em Andamento' ? 'border-blue-600/50 bg-blue-950/10' : 'border-zinc-800'}`}>
                <div className="flex gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      {s.foto_url ? (
                        <img src={s.foto_url} alt="Trator" className="w-28 h-28 rounded-2xl object-cover border border-zinc-700" />
                      ) : (
                        <div className="w-28 h-28 bg-white p-2 rounded-2xl flex items-center justify-center border-4 border-zinc-800">
                          <QRCodeSVG value={s.id} size={90} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-[9px] font-black uppercase text-center block border border-zinc-700 text-zinc-300 active:scale-95">
                        📸 Antes
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => fazerUploadEvidencia(e, s.id, 'antes')} disabled={uploading === s.id} />
                      </label>
                      <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-[9px] font-black uppercase text-center block border border-zinc-700 text-zinc-300 active:scale-95">
                        📸 Depois
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => fazerUploadEvidencia(e, s.id, 'depois')} disabled={uploading === s.id} />
                      </label>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="bg-tractor-yellow text-black px-2 py-0.5 rounded text-[9px] font-black italic mb-1 inline-block uppercase tracking-wider">
                          OS # {s.numero_os || '---'}
                        </span>
                        <h4 className="font-black text-xl uppercase italic text-white leading-tight">{s.trator_nome}</h4>
                        <p className="text-zinc-600 text-[10px] font-black uppercase mt-1">{s.marca}</p>
                      </div>
                      <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black border text-white uppercase tracking-tighter ${
                        s.status === 'Aguardando Peça' ? 'bg-orange-600 border-orange-400' : 
                        s.status === 'Em Andamento' ? 'bg-blue-600 border-blue-400 animate-pulse' : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-5 space-y-2.5">
                      {renderizarChecklist(s)}
                    </div>

                    {/* NOVO: CAMPO DE OBSERVAÇÃO EXTRA (RH) */}
                    <div className="mt-6 border-t border-zinc-800/50 pt-4">
                       <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block tracking-widest">📝 Pedidos Extras (RH / Fora OS)</label>
                       <textarea 
                          defaultValue={s.observacoes_extras || ''}
                          onBlur={(e) => salvarObsExtra(s.id, e.target.value)}
                          placeholder="Digite aqui algo pedido por fora..."
                          className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl text-xs text-zinc-300 outline-none focus:border-blue-500/50 transition-all min-h-[60px] resize-none"
                       />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-2 pt-5 border-t border-zinc-800/60">
                  {s.status !== 'Em Andamento' ? (
                    <button onClick={() => atualizarStatusGeral(s.id, 'Em Andamento')} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] py-4 rounded-2xl uppercase shadow-lg active:scale-95 flex items-center justify-center gap-1">▶ Iniciar</button>
                  ) : (
                    <button onClick={() => atualizarStatusGeral(s.id, 'Pendente')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black text-[11px] py-4 rounded-2xl uppercase active:scale-95">⏸ Pause</button>
                  )}
                  <button onClick={() => atualizarStatusGeral(s.id, s.status === 'Aguardando Peça' ? 'Pendente' : 'Aguardando Peça')} className={`font-black text-[11px] py-4 rounded-2xl uppercase border ${s.status === 'Aguardando Peça' ? 'bg-orange-600 text-white border-orange-400' : 'bg-orange-600/10 text-orange-500 border-orange-600/20'}`}>⚠️ Peça</button>
                  <button onClick={() => window.confirm("Finalizar trator?") && atualizarStatusGeral(s.id, 'Concluído')} className="bg-green-600 hover:bg-green-500 text-white font-black text-[11px] py-4 rounded-2xl uppercase active:scale-95">✅ ProntO</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* NOVO: SEÇÃO DE TRATORES FINALIZADOS (LIXEIRA DE SEGURANÇA) */}
        <div className="mt-16 border-t border-zinc-800 pt-10">
          <button 
            onClick={() => setMostrarFinalizados(!mostrarFinalizados)}
            className="flex items-center gap-3 text-zinc-500 hover:text-white transition-all uppercase font-black text-[10px] tracking-widest bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800"
          >
            {mostrarFinalizados ? '▼ Ocultar Histórico de Hoje' : '▶ Ver Tratores Finalizados (Corrigir)'}
          </button>

          {mostrarFinalizados && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4">
              {servicosFinalizados.length === 0 ? (
                <p className="text-zinc-700 text-[10px] uppercase font-black italic">Nenhum trator finalizado recentemente.</p>
              ) : (
                servicosFinalizados.map(s => (
                  <div key={s.id} className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-2xl flex justify-between items-center group">
                    <div>
                      <h4 className="font-bold text-zinc-400 text-sm uppercase italic">{s.trator_nome}</h4>
                      <p className="text-[9px] text-zinc-600 font-black">OS: {s.numero_os || '---'}</p>
                    </div>
                    <button 
                      onClick={() => atualizarStatusGeral(s.id, 'Em Andamento')}
                      className="bg-blue-600/10 text-blue-500 border border-blue-600/20 px-3 py-2 rounded-xl text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      🔄 REABRIR
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}