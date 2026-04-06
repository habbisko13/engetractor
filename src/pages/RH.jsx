import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/logo.png';

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
    <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      
      {/* HEADER FIXO */}
      <header className="bg-zinc-900/80 border-b border-zinc-800 shadow-2xl z-50 backdrop-blur-md flex-shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Engetractor Logo" className="h-10 md:h-14 w-auto object-contain" />
            <div className="border-l border-zinc-700 pl-4">
              <h1 className="text-sm md:text-xl font-black text-white italic uppercase tracking-wider">RH Engetractor</h1>
              <p className="text-zinc-500 text-[8px] md:text-[10px] font-bold uppercase">Operador: {nome}</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-zinc-800 border border-zinc-700 px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold text-[10px] md:text-xs hover:bg-red-950 transition-all text-white uppercase tracking-widest shadow-md">SAIR</button>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO ROLÁVEL */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6 pb-20">
          
          {/* DASHBOARD CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-wider">Frota</p>
              <h2 className="text-2xl md:text-4xl font-black text-white mt-1">{totalMaquinas}</h2>
            </div>
            <div className="bg-blue-950/20 border border-blue-900/40 p-4 rounded-2xl">
              <p className="text-blue-400 text-[8px] md:text-[10px] font-black uppercase tracking-wider">Oficina</p>
              <h2 className="text-2xl md:text-4xl font-black text-blue-500 mt-1">{emAndamento}</h2>
            </div>
            <div className="bg-orange-950/20 border border-orange-900/40 p-4 rounded-2xl">
              <p className="text-orange-400 text-[8px] md:text-[10px] font-black uppercase tracking-wider">Peças</p>
              <h2 className="text-2xl md:text-4xl font-black text-orange-500 mt-1">{aguardandoPeca}</h2>
            </div>
            <div className="bg-green-950/20 border border-green-900/40 p-4 rounded-2xl">
              <p className="text-green-400 text-[8px] md:text-[10px] font-black uppercase tracking-wider">OK</p>
              <h2 className="text-2xl md:text-4xl font-black text-green-500 mt-1">{concluidas}</h2>
            </div>
          </div>

          {/* BUSCA */}
          <div className="mb-6 sticky top-0 z-40 bg-zinc-950 py-2">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">🔍</span>
              <input 
                type="text" 
                placeholder="Trator, Marca ou OS..." 
                className="w-full bg-zinc-900 border border-zinc-800 p-4 pl-12 rounded-2xl outline-none focus:border-tractor-yellow text-white"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUNA DE CADASTRO (Sticky apenas no Desktop) */}
            <div className="lg:col-span-1">
              <div className={`p-5 rounded-3xl border shadow-2xl lg:sticky lg:top-4 transition-all ${editandoId ? 'bg-blue-950/20 border-blue-500' : 'bg-zinc-900 border-zinc-800'}`}>
                <h3 className="text-md font-black uppercase mb-4 text-tractor-yellow italic flex items-center gap-2">
                  <span>{editandoId ? '✏️ Editando OS' : '📋 Novo Check-in'}</span>
                </h3>
                
                <form onSubmit={cadastrarOuEditarOrdem} className="space-y-4">
                  <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-4 text-center bg-zinc-950/50" onClick={() => document.getElementById('fotoInput').click()}>
                    {previewFoto ? (
                      <img src={previewFoto} alt="Preview" className="h-32 mx-auto rounded-xl object-cover" />
                    ) : (
                      <label className="block text-zinc-600 text-xs font-bold uppercase py-6">📸 Foto do Trator</label>
                    )}
                    <input id="fotoInput" type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                  </div>

                  <input required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none text-tractor-yellow font-bold text-sm" 
                    value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} placeholder="NÚMERO DA OS" />

                  <input required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none text-white text-sm" 
                    value={trator} onChange={(e) => setTrator(e.target.value)} placeholder="Modelo do Trator" />
                  
                  <input required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none text-white text-sm" 
                    value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" />

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    <button type="button" onClick={() => setCamposServico([...camposServico, ''])} className="text-[10px] text-tractor-yellow font-bold uppercase mb-2">+ Adicionar Linha</button>
                    {camposServico.map((servico, index) => (
                      <input key={index} required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none text-sm text-white mb-2"
                        placeholder={`Serviço ${index + 1}`} value={servico} onChange={(e) => {
                          const n = [...camposServico]; n[index] = e.target.value; setCamposServico(n);
                        }} />
                    ))}
                  </div>

                  <button disabled={loading} type="submit" className={`w-full font-black py-4 rounded-2xl transition-all uppercase ${editandoId ? 'bg-blue-600' : 'bg-tractor-yellow text-black'}`}>
                    {loading ? '...' : editandoId ? 'SALVAR' : 'LANÇAR'}
                  </button>

                  {editandoId && (
                    <button type="button" onClick={() => { setEditandoId(null); setTrator(''); setMarca(''); setNumeroOS(''); setCamposServico(['']); setPreviewFoto(null); }} 
                      className="w-full text-zinc-500 font-bold text-[10px] uppercase mt-2">Cancelar</button>
                  )}
                </form>
              </div>
            </div>

            {/* COLUNA DA LISTAGEM (Scroll independente) */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <h3 className="text-sm font-black uppercase text-zinc-600 flex justify-between italic px-1">
                Fila de Espera <span>{servicosFiltrados.length} Maquinas</span>
              </h3>
              
              {servicosFiltrados.map((s) => (
                <div key={s.id} className={`bg-zinc-900 p-5 rounded-3xl border transition-all flex flex-col gap-4 shadow-xl ${s.status === 'Aguardando Peça' ? 'border-orange-600/50 bg-orange-950/10' : 'border-zinc-800'}`}>
                  
                  <div id={`qr-${s.id}`} className="hidden">
                    <QRCodeSVG value={s.id} size={200} level="H" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-2">
                       {s.foto_url && <img src={s.foto_url} alt="Trator" className="w-20 h-20 rounded-xl object-cover border border-zinc-700 shadow-md" />}
                       <div className="bg-white p-1 rounded-lg w-20 h-20 flex items-center justify-center border-2 border-zinc-800">
                          <QRCodeSVG value={s.id} size={70} />
                       </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-tractor-yellow text-black px-2 py-0.5 rounded-md font-black italic text-[9px] uppercase">OS: {s.numero_os || '---'}</span>
                          <h4 className="font-black text-xl uppercase italic text-white mt-1">{s.trator_nome}</h4>
                          <p className="text-zinc-600 text-[10px] font-bold uppercase">{s.marca}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase border text-center ${s.status === 'Aguardando Peça' ? 'bg-orange-600 border-orange-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>{s.status}</span>
                          <button onClick={() => imprimirTag(s.id, s.trator_nome, s.numero_os)} className="text-[9px] bg-white text-black font-black px-2 py-1.5 rounded-lg">🖨️ TAG</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/70">
                    {renderizarTarefas(s.servico_descricao)}
                  </div>

                  <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                    <button onClick={() => alternarStatusPeça(s.id, s.status)} className={`text-[10px] font-black uppercase p-3 rounded-xl border ${s.status === 'Aguardando Peça' ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-600/20 text-orange-500 border-orange-600/30'}`}>
                      {s.status === 'Aguardando Peça' ? '✓ Peça Chegou' : '⚠️ Falta Peça'}
                    </button>
                    <button onClick={() => buscarLogs(s.id)} className="text-[10px] font-black uppercase p-3 rounded-xl bg-zinc-800 text-zinc-400">📜 Log</button>
                    <button onClick={() => buscarEvidencias(s.id)} className="text-[10px] font-black uppercase p-3 rounded-xl bg-blue-900/20 text-blue-400">📸 Fotos</button>
                    <button onClick={() => prepararEdicao(s)} className="text-[10px] font-black uppercase p-3 rounded-xl bg-zinc-800 text-blue-400">✏️ Editar</button>
                    <button onClick={() => excluirServico(s.id)} className="text-[10px] font-black uppercase p-3 rounded-xl bg-zinc-800 text-red-500 col-span-2 md:col-span-1">🗑️ Excluir</button>
                  </div>

                  {historicoAberto === s.id && (
                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800">
                      <div className="flex justify-between mb-3"><span className="text-[9px] font-black text-tractor-yellow uppercase">Histórico</span><button onClick={() => setHistoricoAberto(null)} className="text-[9px]">X</button></div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {logs.map((log) => (
                          <div key={log.id} className="border-l border-zinc-800 pl-3 py-1">
                            <p className="text-xs text-zinc-300 font-bold">{log.acao}</p>
                            <p className="text-[8px] text-zinc-600 uppercase">{new Date(log.data_hora).toLocaleString('pt-BR')} • {log.usuario}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evidenciasAbertas === s.id && (
                    <div className="bg-zinc-900/60 rounded-xl p-4 border border-blue-900/30">
                      <div className="flex justify-between mb-3"><span className="text-[9px] font-black text-blue-400 uppercase">Evidências</span><button onClick={() => setEvidenciasAbertas(null)} className="text-[9px]">X</button></div>
                      <div className="grid grid-cols-2 gap-2">
                        {fotosEvidencia.map((f) => (
                          <div key={f.id} className="relative">
                            <img src={f.foto_url} className="w-full h-24 object-cover rounded-lg" onClick={() => window.open(f.foto_url, '_blank')} />
                            <span className={`absolute top-1 left-1 px-1 rounded text-[7px] font-black text-white ${f.tipo === 'antes' ? 'bg-red-600' : 'bg-green-600'}`}>{f.tipo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}