import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, FileText, ChevronRight, Loader2 } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Dashboard({ onNewCase, onOpenCase, onLogout }) {
  const [savedCases, setSavedCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await api.get('/api/cases');
        setSavedCases(response.data || []);
      } catch (err) {
        console.error("Erro ao carregar casos:", err);
        setSavedCases([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Stethoscope size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">OTTO CASES</h1>
            <p className="text-slate-500 text-sm font-medium">Painel do Médico</p>
          </div>
        </div>
        <Button variant="outline" onClick={onLogout} size="sm">
          Sair
        </Button>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Meus Casos</h2>
          <Button onClick={onNewCase}>
            <Plus size={18} /> Novo Relato de Caso
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : savedCases.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-lg border border-dashed border-slate-300">
            <p className="text-slate-500 mb-4">Nenhum caso cadastrado ainda.</p>
            <Button onClick={onNewCase}><Plus size={16} className="mr-2"/> Criar Primeiro Relato</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCases.map((c) => (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onOpenCase(c.id)}>
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                  <FileText size={20} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.status === 'generated' || c.status === 'Gerado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.status === 'generated' || c.status === 'Gerado' ? "Relato Finalizado" : "Rascunho Clínico"}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                {c.aiTitle || (c.complaint ? `Caso: ${c.complaint}` : "Relato de Caso em Branco")}
              </h3>
              <div className="flex items-center justify-between text-sm text-slate-500 border-t pt-3 mt-4">
                <span>{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—'}</span>
                <ChevronRight size={16} />
              </div>
            </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
