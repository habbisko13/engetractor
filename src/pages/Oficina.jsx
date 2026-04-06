import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/logo.png'; // IMPORTAÇÃO DA LOGO

export default function Oficina({ nome, onLogout }) {
  const [servicos, setServicos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(null); // Armazena o ID do serviço em upload

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

  // REGISTRO DE LOGS
  const registrarLog = async (servicoId, acao) => {
    await supabase.from('historico_servicos').insert([
      { servico_id: servicoId, acao: acao, usuario: nome }
    ]);
  };

  // UPLOAD DE FOTOS DE EVIDÊNCIA
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
      await registrarLog(id, `Alterou status geral para: ${novoStatus}`);
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
      console.log("Este serviço está no formato antigo (texto)");
    }
  };

  const servicosAtivos = servicos.filter(s => {
    const termo = busca.toLowerCase();
    const osManual = (s.numero_os || '').toLowerCase();
    return (
      (s.trator_nome.toLowerCase().includes(termo) || 
       s.marca.toLowerCase().includes(termo) ||
       osManual.includes(termo)) &&
      s.status !== 'Concluído'
    );
  });

  const renderizarChecklist = (s) => {
    try {
      const tarefas = JSON.parse(s.servico_descricao);
      return tarefas.map((item, i) => (
        <div 
          key={i} 
          onClick={() => alternarItemServico(s, i)}
          className={`flex flex-col gap-1.5 p-4 rounded-2xl cursor-pointer transition-all border shadow-sm ${
            item.concluida 
            ? 'bg-green-950/20 border-green-800/40 text-green-500' 
            : 'bg-zinc-950 border-zinc-800/60 text-zinc-300 hover:border-tractor-yellow active:scale-95'
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
      
      {/* HEADER PREMIUM COM LOGO */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {servicosAtivos.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-zinc-700 italic font-black uppercase tracking-widest text-sm">Nenhum serviço pendente na oficina...</p>
            </div>
          ) : (
            servicosAtivos.map((s) => (
              <div key={s.id} className={`bg-zinc-900 p-6 rounded-3xl border transition-all flex flex-col gap-5 shadow-2xl ${s.status === 'Em Andamento' ? 'border-blue-600/50 bg-blue-950/10 shadow-[0_0_30px_rgba(37,99,235,0.1)]' : 'border-zinc-800'}`}>
                
                <div className="flex gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      {s.foto_url ? (
                        <img src={s.foto_url} alt="Trator" className="w-28 h-28 rounded-2xl object-cover border border-zinc-700 shadow-md" />
                      ) : (
                        <div className="w-28 h-28 bg-white p-2 rounded-2xl flex items-center justify-center border-4 border-zinc-800 shadow-inner">
                          <QRCodeSVG value={s.id} size={90} />
                        </div>
                      )}
                      {uploading === s.id && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                           <div className="w-6 h-6 border-2 border-tractor-yellow border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* BOTÕES DE EVIDÊNCIA ESTILIZADOS */}
                    <div className="flex flex-col gap-1.5">
                      <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-[9px] font-black uppercase text-center block border border-zinc-700 text-zinc-300 transition-colors shadow-sm active:scale-95">
                        📸 Antes
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fazerUploadEvidencia(e, s.id, 'antes')} disabled={uploading === s.id} />
                      </label>
                      <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-[9px] font-black uppercase text-center block border border-zinc-700 text-zinc-300 transition-colors shadow-sm active:scale-95">
                        📸 Depois
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fazerUploadEvidencia(e, s.id, 'depois')} disabled={uploading === s.id} />
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
                      <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black border text-white shadow-sm uppercase tracking-tighter ${
                        s.status === 'Aguardando Peça' ? 'bg-orange-600 border-orange-400' : 
                        s.status === 'Em Andamento' ? 'bg-blue-600 border-blue-400 animate-pulse' : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    
                    <div className="mt-5 space-y-2.5">
                      {renderizarChecklist(s)}
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE CONTROLE GERAL */}
                <div className="grid grid-cols-3 gap-3 mt-2 pt-5 border-t border-zinc-800/60">
                  {s.status !== 'Em Andamento' ? (
                    <button 
                      disabled={loading}
                      onClick={() => atualizarStatusGeral(s.id, 'Em Andamento')}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] py-4 rounded-2xl uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1"
                    >
                      ▶ Iniciar
                    </button>
                  ) : (
                    <button 
                      disabled={loading}
                      onClick={() => atualizarStatusGeral(s.id, 'Pendente')}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black text-[11px] py-4 rounded-2xl uppercase transition-all shadow-lg active:scale-95"
                    >
                      ⏸ Pause
                    </button>
                  )}

                  <button 
                    disabled={loading}
                    onClick={() => atualizarStatusGeral(s.id, s.status === 'Aguardando Peça' ? 'Pendente' : 'Aguardando Peça')}
                    className={`font-black text-[11px] py-4 rounded-2xl uppercase transition-all shadow-lg active:scale-95 border ${
                      s.status === 'Aguardando Peça' ? 'bg-orange-600 text-white border-orange-400' : 'bg-orange-600/10 text-orange-500 border-orange-600/20 hover:bg-orange-600/20'
                    }`}
                  >
                    ⚠️ Peça
                  </button>

                  <button 
                    disabled={loading}
                    onClick={() => {
                      if(window.confirm("Deseja finalizar este trator por completo?")) {
                        atualizarStatusGeral(s.id, 'Concluído');
                      }
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white font-black text-[11px] py-4 rounded-2xl uppercase transition-all shadow-lg active:scale-95"
                  >
                    ✅ ProntO
                  </button>
                </div>
                {uploading === s.id && <div className="text-[10px] text-tractor-yellow animate-pulse font-black text-center italic tracking-widest mt-2 uppercase">Subindo imagem para o RH...</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}