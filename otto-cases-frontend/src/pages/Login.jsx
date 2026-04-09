import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/Input';
import { Stethoscope } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login({ onLoginComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      setLoading(false);
      
      if (error) {
        alert("Erro no cadastro: Verifique os dados fornecidos. A senha deve ter ao menos 6 caracteres.");
      } else {
        alert("Cadastro na Beta efetuado com sucesso! Se a plataforma pedir, confirme seu e-mail. Caso contrário, realize o login normalmente agora.");
        setIsRegistering(false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      
      if (error) {
        alert("Erro de autenticação: Verifique seu e-mail e senha. Se ainda não possui conta, crie a sua no botão de cadastro.");
      } else {
        onLoginComplete();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-100">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl text-white mb-4">
            <Stethoscope size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">OTTO CASES</h1>
          <p className="text-slate-500 text-sm text-center mt-2">
            Acesso Beta Exclusivo para Residentes OTTO
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <InputField 
            label="E-mail Institucional ou Pessoal" 
            type="email" 
            placeholder="medico@hospital.com.br" 
            value={email} 
            onChange={setEmail} 
            required 
          />
          <InputField 
            label="Senha (mín. 6 caracteres)" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={setPassword} 
            required 
          />
          
          <Button type="submit" className={`w-full py-3 mt-4 ${isRegistering ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} disabled={loading}>
            {loading ? "Processando..." : (isRegistering ? "Criar Minha Conta Beta" : "Acessar Plataforma")}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
          <p className="text-sm text-slate-600 mb-4 font-medium">
            {isRegistering ? "Já possui uma conta?" : "Não possui acesso ao Beta?"}
          </p>
          <Button variant="outline" className="w-full" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Fazer Login" : "Cadastrar na Plataforma Beta"}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Acesso restrito a profissionais médicos e residentes.
        </p>
      </div>
    </div>
  );
}
