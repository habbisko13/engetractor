import React, { useState } from 'react';
import logoImg from './assets/logo.png'; 
import { supabase } from './supabaseClient'; 
import RH from './pages/RH';
import Oficina from './pages/Oficina';
import Almoxarifado from './pages/Almoxarifado'; // Importando a nova página

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAlmoxarifado, setIsAlmoxarifado] = useState(false); // Novo estado para Almoxarifado

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // LOGIN SECRETO RH
    if (!isRegistering && email === 'rh@engetractor.com' && password === 'admin123') {
      setNome('ADMINISTRADOR RH');
      setIsAdmin(true);
      setIsAlmoxarifado(false);
      setIsLoggedIn(true);
      setLoading(false);
      return;
    }

    // --- NOVO LOGIN SECRETO ALMOXARIFADO ---
    if (!isRegistering && email === 'estoque@engetractor.com' && password === 'pecas123') {
      setNome('RESPONSÁVEL ESTOQUE');
      setIsAlmoxarifado(true);
      setIsAdmin(false);
      setIsLoggedIn(true);
      setLoading(false);
      return;
    }

    if (isRegistering) {
      // 1. Cadastra no sistema de Autenticação
      const { data, error } = await supabase.auth.signUp({
        email, 
        password, 
        options: { data: { nome_completo: nome } }
      });

      if (error) {
        alert(error.message);
      } else { 
        // 2. CRUCIAL: Salva na tabela pública de perfis para o RH poder listar
        const { error: profileError } = await supabase
          .from('perfis')
          .insert([
            { 
              id: data.user.id, 
              nome_completo: nome, 
              email: email,
              cargo: 'Operador' // Padrão inicial
            }
          ]);

        if (profileError) {
          console.error("Erro ao criar perfil público:", profileError);
        }

        alert("Cadastro realizado com sucesso!"); 
        setIsRegistering(false); 
      }
    } else {
      // LOGIN NORMAL
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
      } else {
        setNome(data.user.user_metadata?.nome_completo || 'OPERADOR');
        setIsAdmin(false);
        setIsAlmoxarifado(false);
        setIsLoggedIn(true);
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setIsAlmoxarifado(false);
    setEmail('');
    setPassword('');
    setNome('');
  };

  // LÓGICA DE ROTEAMENTO SIMPLES
  if (isLoggedIn) {
    if (isAdmin) return <RH nome={nome} onLogout={handleLogout} />;
    if (isAlmoxarifado) return <Almoxarifado nome={nome} onLogout={handleLogout} />;
    return <Oficina nome={nome} onLogout={handleLogout} />;
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border-t-4 border-tractor-yellow bg-tractor-card p-10 shadow-2xl">
        <div className="mb-10 flex flex-col items-center">
          <img src={logoImg} alt="Logo" className="mb-5 h-24 object-contain" onError={(e) => e.target.style.display='none'}/>
          <h1 className="text-3xl font-black uppercase text-center">{isRegistering ? 'Nova Conta' : 'Acesso'}</h1>
          <div className="mt-2 h-1.5 w-20 bg-tractor-yellow rounded-full"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && (
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Nome Completo</label>
              <input required type="text" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-white outline-none focus:border-tractor-yellow transition-all" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">E-mail</label>
            <input required type="email" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-white outline-none focus:border-tractor-yellow transition-all" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@engetractor.com" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Senha</label>
            <input required type="password" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-white outline-none focus:border-tractor-yellow transition-all" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button disabled={loading} type="submit" className="w-full rounded-lg bg-tractor-yellow py-4 font-black uppercase text-black hover:bg-yellow-500 active:scale-95 transition-all shadow-lg disabled:opacity-50">
            {loading ? 'CARREGANDO...' : isRegistering ? 'Cadastrar Operador' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-zinc-800">
          <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-tractor-yellow font-bold hover:underline">
            {isRegistering ? 'VOLTAR PARA LOGIN' : 'CRIAR NOVA CONTA'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;