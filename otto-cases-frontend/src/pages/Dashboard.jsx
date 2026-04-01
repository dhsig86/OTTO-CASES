import React from 'react';
import { Stethoscope, Plus, FileText, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Dashboard({ onNewCase, onLogout }) {
  // Simulando casos salvos
  const savedCases = [
    { id: 1, title: "Relato de Caso: Paraganglioma Timpânico", date: "01/04/2026", status: "Gerado" },
    { id: 2, title: "Rinossinusite Aguda Complicada", date: "28/03/2026", status: "Rascunho" },
  ];

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedCases.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                  <FileText size={20} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.status === 'Gerado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.status}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                {c.title}
              </h3>
              <div className="flex items-center justify-between text-sm text-slate-500 border-t pt-3 mt-4">
                <span>{c.date}</span>
                <ChevronRight size={16} />
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
