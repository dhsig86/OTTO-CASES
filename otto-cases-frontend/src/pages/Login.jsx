import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/Input';
import { Stethoscope } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login({ onLoginComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    
    if (error) {
      alert("Erro de autenticação: Verifique seu e-mail e senha.");
    } else {
      onLoginComplete();
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
            Inteligência Clínica para estruturação de Relatos de Caso e E-Pôsteres
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <InputField 
            label="E-mail Institucional" 
            type="email" 
            placeholder="medico@hospital.com.br" 
            value={email} 
            onChange={setEmail} 
            required 
          />
          <InputField 
            label="Senha" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={setPassword} 
            required 
          />
          
          <Button type="submit" className="w-full py-3 mt-4" disabled={loading}>
            {loading ? "Entrando..." : "Acessar Plataforma"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8">
          Acesso restrito a profissionais médicos e acadêmicos.
        </p>
      </div>
    </div>
  );
}
