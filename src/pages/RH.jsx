import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/logo.png'; // IMPORTAÇÃO DA LOGO

export default function RH({ nome, onLogout }) {
  const [servicosListados, setServicosListados] = useState([]);
  const [busca, setBusca] = useState(''); 
  const [trator, setTrator] = useState('');
  const [marca, setMarca] = useState('');
  const [numeroOS, setNumeroOS] = useState('');
  const [camposServico, setCamposServico] = useState(['']); 
  const [foto, setFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [loading, setLoading] = useState(false);

  // ESTADOS PARA CONTROLE DE EDIÇÃO, HISTÓRICO E EVIDÊNCIAS
  const [editandoId, setEditandoId] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(null);
  const [evidenciasAbertas, setEvidenciasAbertas] = useState(null); 
  const [logs, setLogs] = useState([]);
  const [fotosEvidencia, setFotosEvidencia] = useState([]);

  const buscarServicos = async () => {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .order('criado_em', { ascending: false });
    if (!error) setServicosListados(data);
  };

  useEffect(() => {
    buscarServicos();
  }, []);

  // LÓGICA DO DASHBOARD
  const totalMaquinas = servicosListados.length;
  const emAndamento = servicosListados.filter(s => s.status === 'Em Andamento').length;
  const aguardandoPeca = servicosListados.filter(s => s.status === 'Aguardando Peça').length;
  const concluidas = servicosListados.filter(s => s.status === 'Finalizado' || s.status === 'Concluído').length;

  const registrarLog = async (servicoId, acao) => {
    await supabase.from('historico_servicos').insert([
      { servico_id: servicoId, acao: acao, usuario: nome }
    ]);
  };

  const buscarLogs = async (servicoId) => {
    setHistoricoAberto(servicoId);
    setEvidenciasAbertas(null); 
    const { data, error } = await supabase
      .from('historico_servicos')
      .select('*')
      .eq('servico_id', servicoId)
      .order('data_hora', { ascending: false });
    if (!error) setLogs(data);
  };

  const buscarEvidencias = async (servicoId) => {
    setEvidenciasAbertas(servicoId);
    setHistoricoAberto(null); 
    const { data, error } = await supabase
      .from('evidencias_servico')
      .select('*')
      .eq('servico_id', servicoId)
      .order('criado_em', { ascending: true });
    if (!error) setFotosEvidencia(data);
  };

  const alternarStatusPeça = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'Aguardando Peça' ? 'Pendente' : 'Aguardando Peça';
    const { error } = await supabase
      .from('servicos')
      .update({ status: novoStatus })
      .eq('id', id);
    
    if (!error) {
      await registrarLog(id, `Alterou status de peça para: ${novoStatus}`);
      buscarServicos();
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const prepararEdicao = (s) => {
    setEditandoId(s.id);
    setTrator(s.trator_nome);
    setMarca(s.marca);
    setNumeroOS(s.numero_os || '');
    setPreviewFoto(s.foto_url);
    try {
      const tarefas = JSON.parse(s.servico_descricao);
      setCamposServico(tarefas.map(t => t.tarefa));
    } catch (e) {
      setCamposServico([s.servico_descricao]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirServico = async (id) => {
    if (window.confirm("ATENÇÃO: Deseja EXCLUIR esta OS permanentemente?")) {
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (!error) buscarServicos();
    }
  };

  const imprimirTag = (id, tratorNome, osManual) => {
    const win = window.open('', 'PRINT', 'height=600,width=800');
    const qrSvg = document.getElementById(`qr-${id}`).innerHTML;
    win.document.write(`<html><body style="text-align:center; font-family: sans-serif; padding: 40px; border: 5px solid #000;"><h1 style="margin: 0; font-size: 30px;">ENGETRACTOR</h1><p style="font-size: 14px; font-weight: bold; margin-bottom: 20px;">MANUTENÇÃO DE MÁQUINAS</p><div style="background: #000; color: #fff; padding: 15px; display: inline-block; font-size: 45px; font-weight: 900; margin-bottom: 10px;">OS: ${osManual || '---'}</div><h2 style="text-transform: uppercase; font-size: 28px; margin: 10px 0;">${tratorNome}</h2><hr style="border: 1px solid #000;" /><div style="margin: 20px auto; display: inline-block;">${qrSvg}</div><p style="font-size: 14px; margin-top: 10px;">Acesso digital para detalhes e histórico</p><script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>`);
    win.document.close();
  };

  const servicosFiltrados = servicosListados.filter(s => {
    const termo = busca.toLowerCase();
    const osManual = (s.numero_os || '').toLowerCase();
    return (
      s.trator_nome.toLowerCase().includes(termo) ||
      s.marca.toLowerCase().includes(termo) ||
      osManual.includes(termo)
    );
  });

  const cadastrarOuEditarOrdem = async (e) => {
    e.preventDefault();
    setLoading(true);
    let fotoUrlFinal = previewFoto;

    if (foto) {
      const nomeArquivo = `checkin_${Date.now()}_${foto.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('fotos-checkin').upload(nomeArquivo, foto);
      
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('fotos-checkin').getPublicUrl(nomeArquivo);
        fotoUrlFinal = publicUrlData.publicUrl;
      }
    }

    const listaDeTarefas = camposServico
      .filter(s => s.trim() !== '')
      .map(s => ({ tarefa: s, concluida: false, finalizado_por: null, finalizado_em: null }));

    const dadosOS = { 
      trator_nome: trator, 
      marca: marca, 
      numero_os: numeroOS,
      servico_descricao: JSON.stringify(listaDeTarefas), 
      foto_url: fotoUrlFinal 
    };

    if (editandoId) {
      const { error } = await supabase.from('servicos').update(dadosOS).eq('id', editandoId);
      if (!error) await registrarLog(editandoId, `Editou informações da OS ${numeroOS}`);
    } else {
      const { data, error } = await supabase.from('servicos').insert([{ ...dadosOS, criado_por: nome }]).select();
      if (!error && data) await registrarLog(data[0].id, `Criou a OS ${numeroOS} no sistema`);
    }

    setTrator(''); setMarca(''); setNumeroOS(''); setCamposServico(['']); setFoto(null); setPreviewFoto(null);
    setEditandoId(null);
    buscarServicos();
    setLoading(false);
  };

  const renderizarTarefas = (descricao) => {
    try {
      const tarefas = JSON.parse(descricao);
      return tarefas.map((item, i) => (
        <div key={i} className="mb-2 last:mb-0">
          <div className="text-sm flex items-center gap-2">
            <span className={item.concluida ? "text-green-500 font-bold" : "text-tractor-yellow"}>
              {item.concluida ? "✓" : "›"}
            </span>
            <span className={item.concluida ? "line-through text-zinc-500" : "text-zinc-300 font-medium"}>
              {item.tarefa}
            </span>
          </div>
        </div>
      ));
    } catch (e) {
      return <div className="text-sm text-zinc-300">{descricao}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      
      {/* HEADER REESTRUTURADO COM LOGOTIPO */}
      <header className="bg-zinc-900/80 border-b border-zinc-800 shadow-2xl sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Engetractor Logo" className="h-14 w-auto object-contain" />
            <div className="border-l border-zinc-700 pl-4">
              <h1 className="text-xl font-black text-white italic uppercase tracking-wider">RH Engetractor</h1>
              <p className="text-zinc-500 text-[10px] font-bold uppercase">Operador: {nome}</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-zinc-800 border border-zinc-700 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-red-950 transition-all text-white uppercase tracking-widest shadow-md">SAIR</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* --- DASHBOARD --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Total Frota</p>
            <h2 className="text-4xl font-black text-white mt-1">{totalMaquinas}</h2>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/40 p-5 rounded-2xl shadow-lg">
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-wider">Em Oficina</p>
            <h2 className="text-4xl font-black text-blue-500 mt-1">{emAndamento}</h2>
          </div>
          <div className="bg-orange-950/20 border border-orange-900/40 p-5 rounded-2xl shadow-lg">
            <p className="text-orange-400 text-[10px] font-black uppercase tracking-wider">Aguard. Peça</p>
            <h2 className="text-4xl font-black text-orange-500 mt-1">{aguardandoPeca}</h2>
          </div>
          <div className="bg-green-950/20 border border-green-900/40 p-5 rounded-2xl shadow-lg">
            <p className="text-green-400 text-[10px] font-black uppercase tracking-wider">Concluídas</p>
            <h2 className="text-4xl font-black text-green-500 mt-1">{concluidas}</h2>
          </div>
        </div>

        <div className="mb-8">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-tractor-yellow transition-colors">🔍</span>
            <input 
              type="text" 
              placeholder="Pesquisar por Trator, Marca ou Número da OS..." 
              className="w-full bg-zinc-900 border border-zinc-800 p-4.5 pl-12 rounded-2xl outline-none focus:border-tractor-yellow transition-all shadow-inner text-white placeholder:text-zinc-600"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUNA DE CADASTRO */}
          <div className={`p-6 rounded-3xl border shadow-2xl h-fit sticky top-24 transition-all ${editandoId ? 'bg-blue-950/10 border-blue-500' : 'bg-zinc-900 border-zinc-800'}`}>
            <h3 className="text-lg font-black uppercase mb-6 text-tractor-yellow flex items-center gap-2 italic">
              <span>{editandoId ? '✏️ Editando OS' : '📋 Novo Check-in'}</span>
            </h3>
            <form onSubmit={cadastrarOuEditarOrdem} className="space-y-4">
              <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-4 text-center hover:border-tractor-yellow/50 transition-colors cursor-pointer bg-zinc-950/50" onClick={() => document.getElementById('fotoInput').click()}>
                {previewFoto ? (
                  <img src={previewFoto} alt="Preview" className="h-40 mx-auto rounded-xl object-cover border border-zinc-700 shadow-md" />
                ) : (
                  <label className="block text-zinc-600 text-sm font-bold uppercase cursor-pointer py-10">📸 Adicionar Foto</label>
                )}
                <input id="fotoInput" type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
              </div>

              <input required className="w-full bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl outline-none focus:border-tractor-yellow text-tractor-yellow font-bold" 
                value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} placeholder="NÚMERO DA OS (EX: 5044)" />

              <input required className="w-full bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl outline-none focus:border-tractor-yellow text-white" 
                value={trator} onChange={(e) => setTrator(e.target.value)} placeholder="Trator / Modelo" />
              
              <input required className="w-full bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl outline-none focus:border-tractor-yellow text-white" 
                value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" />

              <div className="space-y-2.5">
                <button type="button" onClick={() => setCamposServico([...camposServico, ''])} className="text-xs text-tractor-yellow font-bold uppercase hover:underline">+ Adicionar Serviço</button>
                {camposServico.map((servico, index) => (
                  <input key={index} required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none text-sm text-white focus:border-tractor-yellow"
                    placeholder={`Serviço ${index + 1}`} value={servico} onChange={(e) => {
                      const n = [...camposServico]; n[index] = e.target.value; setCamposServico(n);
                    }} />
                ))}
              </div>

              <button disabled={loading} type="submit" className={`w-full font-black py-4.5 rounded-2xl transition-all uppercase shadow-lg active:scale-95 ${editandoId ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-tractor-yellow text-black hover:bg-yellow-500'}`}>
                {loading ? 'PROCESSANDO...' : editandoId ? 'SALVAR ALTERAÇÕES' : 'LANÇAR NA OFICINA'}
              </button>

              {editandoId && (
                <button 
                  type="button" 
                  onClick={() => { setEditandoId(null); setTrator(''); setMarca(''); setNumeroOS(''); setCamposServico(['']); setPreviewFoto(null); }} 
                  className="w-full text-zinc-600 font-bold text-xs uppercase mt-2.5 hover:text-white transition-colors"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </div>

          {/* COLUNA DA LISTAGEM */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-lg font-black uppercase text-zinc-600 flex justify-between italic">
              Máquinas em Atendimento <span>{servicosFiltrados.length}</span>
            </h3>
            
            {servicosFiltrados.map((s) => (
              <div key={s.id} className={`bg-zinc-900 p-6 rounded-3xl border transition-all flex flex-col md:flex-row gap-6 shadow-xl ${s.status === 'Aguardando Peça' ? 'border-orange-600/50 bg-orange-950/10' : 'border-zinc-800'}`}>
                
                <div id={`qr-${s.id}`} className="hidden">
                  <QRCodeSVG value={s.id} size={200} level="H" />
                </div>

                <div className="flex flex-row md:flex-col gap-3 justify-center md:justify-start">
                   {s.foto_url && <img src={s.foto_url} alt="Trator" className="w-28 h-28 rounded-2xl object-cover border border-zinc-700 shadow-md" />}
                   <div className="bg-white p-1.5 rounded-xl w-28 h-28 flex items-center justify-center border-2 border-zinc-800 shadow-inner">
                      <QRCodeSVG value={s.id} size={100} />
                   </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="bg-tractor-yellow text-black px-2.5 py-1 rounded-lg font-black italic mb-1.5 inline-block uppercase text-[10px] tracking-wider">
                        OS: {s.numero_os || '---'}
                      </span>
                      <h4 className="font-black text-2xl uppercase italic text-white leading-tight">{s.trator_nome}</h4>
                    </div>
                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      <div className="flex gap-2">
                         <button onClick={() => prepararEdicao(s)} className="text-[10px] bg-blue-600/15 text-blue-400 font-black px-3 py-1.5 rounded-lg border border-blue-600/30 uppercase hover:bg-blue-600 hover:text-white transition-all">Editar</button>
                         <button onClick={() => excluirServico(s.id)} className="text-[10px] bg-red-600/15 text-red-400 font-black px-3 py-1.5 rounded-lg border border-red-600/30 uppercase hover:bg-red-600 hover:text-white transition-all">Excluir</button>
                      </div>
                      <span className={`text-[11px] px-3 py-1.5 rounded-xl font-black uppercase border text-white tracking-wider shadow-md ${s.status === 'Aguardando Peça' ? 'bg-orange-600 border-orange-400' : s.status === 'Finalizado' || s.status === 'Concluído' ? 'bg-green-600 border-green-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {s.status}
                      </span>
                      <button 
                        onClick={() => imprimirTag(s.id, s.trator_nome, s.numero_os)}
                        className="text-[10px] bg-white text-black font-black px-4 py-2 rounded-xl hover:bg-tractor-yellow transition-colors uppercase shadow-lg flex items-center gap-1.5"
                      >
                        🖨️ Imprimir Tag
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-zinc-600 text-xs font-bold uppercase mt-1 tracking-wide">{s.marca}</p>
                  
                  <div className="mt-4 space-y-3 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/70 shadow-inner">
                    {renderizarTarefas(s.servico_descricao)}
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-800/60 flex flex-wrap gap-2.5">
                    <button 
                      onClick={() => alternarStatusPeça(s.id, s.status)}
                      className={`text-[11px] font-black uppercase px-4 py-2.5 rounded-xl transition-all shadow active:scale-95 ${s.status === 'Aguardando Peça' ? 'bg-zinc-800 text-zinc-500 hover:text-white' : 'bg-orange-600/15 text-orange-500 border border-orange-600/30 hover:bg-orange-600 hover:text-white'}`}
                    >
                      {s.status === 'Aguardando Peça' ? '✓ Peça Chegou' : '⚠️ Falta Peça'}
                    </button>

                    <button 
                      onClick={() => buscarLogs(s.id)}
                      className="text-[11px] font-black uppercase px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all shadow active:scale-95"
                    >
                      📜 Histórico
                    </button>

                    <button 
                      onClick={() => buscarEvidencias(s.id)}
                      className="text-[11px] font-black uppercase px-4 py-2.5 rounded-xl bg-blue-900/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow active:scale-95"
                    >
                      📸 Fotos Oficina
                    </button>
                  </div>

                  {historicoAberto === s.id && (
                    <div className="mt-5 bg-black/40 rounded-2xl p-5 border border-zinc-800 shadow-inner animate-in fade-in slide-in-from-top-3">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[11px] font-black uppercase text-tractor-yellow italic tracking-wider">Linha do Tempo</h5>
                        <button onClick={() => setHistoricoAberto(null)} className="text-zinc-600 text-xs font-bold hover:text-white transition-colors">FECHAR X</button>
                      </div>
                      <div className="space-y-3.5 max-h-48 overflow-y-auto pr-2.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        {logs.map((log) => (
                          <div key={log.id} className="border-l-2 border-zinc-800 pl-4 py-1.5 relative">
                            <div className="absolute w-2.5 h-2.5 bg-tractor-yellow rounded-full -left-[6px] top-2.5 shadow-[0_0_8px_rgba(255,200,0,0.6)]"></div>
                            <p className="text-sm text-zinc-200 font-bold leading-snug">{log.acao}</p>
                            <p className="text-[9px] text-zinc-600 uppercase mt-1.5 font-medium tracking-wide">
                              {new Date(log.data_hora).toLocaleString('pt-BR')} • {log.usuario}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evidenciasAbertas === s.id && (
                    <div className="mt-5 bg-zinc-900/60 rounded-2xl p-5 border border-blue-900/30 shadow-inner animate-in zoom-in-95">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[11px] font-black uppercase text-blue-400 italic tracking-wider">Evidências: Antes & Depois</h5>
                        <button onClick={() => setEvidenciasAbertas(null)} className="text-zinc-600 text-xs font-bold hover:text-white transition-colors">FECHAR X</button>
                      </div>
                      {fotosEvidencia.length === 0 ? (
                        <p className="text-xs text-zinc-700 italic text-center py-6">Nenhuma foto anexada pela oficina até o momento.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {fotosEvidencia.map((f) => (
                            <div key={f.id} className="group relative">
                              <div className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase z-10 text-white shadow-md ${f.tipo === 'antes' ? 'bg-red-600' : 'bg-green-600'}`}>
                                {f.tipo}
                              </div>
                              <img 
                                src={f.foto_url} 
                                alt="Evidência" 
                                className="w-full h-36 object-cover rounded-xl border border-zinc-800 hover:border-blue-500 transition-all cursor-pointer shadow-md group-hover:shadow-2xl"
                                onClick={() => window.open(f.foto_url, '_blank')}
                              />
                              <p className="text-[9px] text-zinc-600 mt-1.5 uppercase italic truncate font-medium tracking-wide">{f.descricao || 'Sem descrição'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}