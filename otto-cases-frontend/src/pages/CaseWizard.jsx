import React, { useState, useEffect, useRef } from 'react';
import { 
  Stethoscope, FileText, Image as ImageIcon, Send, CheckCircle, 
  ChevronRight, ChevronLeft, User, Activity, ClipboardList, AlertCircle, Download, Languages, Eye, Save, Loader2, BookOpen, X, Wand2
} from 'lucide-react';
import axios from 'axios';
import api from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { InputField, TextAreaField } from '../components/ui/Input';

export default function CaseWizard({ onBack, caseId }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'Digitando...', 'Salvando...', 'Salvo', 'Erro'
  const [isDataLoaded, setIsDataLoaded] = useState(caseId ? false : true);
  const [currentCaseId, setCurrentCaseId] = useState(caseId || null);
  const [showReferences, setShowReferences] = useState(false);
  
  const [formData, setFormData] = useState({
    authorName: "", institution: "", ethicsApproval: false, patientAge: "", patientGender: "", patientProfession: "",
    complaint: "", history: "", physicalExam: "", diagnostics: "", intervention: "", outcome: "", keywords: "",
    isSurgical: false, clavienDindo: "", imageUrls: []
  });

  const [aiOutput, setAiOutput] = useState({
    advisorFeedback: "", title: "", submissionSummary: "", draftArticle: "", posterContent: "", posterWidth: "1080", posterHeight: "1920"
  });

  // H.3 - AUTOSAVE COM DEBOUNCE E LOCALSTORAGE
  React.useEffect(() => {
    if (!isDataLoaded) return; // Não salvar por cima enquanto o GET ainda roda

    const draftKey = currentCaseId ? `otto-cases:draft:${currentCaseId}` : `otto-cases:draft:new`;
    
    // 1. Snapshot local imediato e offline-safe (proteção contra rede caindo)
    const snapshot = { formData, aiOutput, updatedAt: new Date().toISOString() };
    localStorage.setItem(draftKey, JSON.stringify(snapshot));

    // 2. Debounce para o Firebase via API (espera médico parar de digitar por 3 segundos)
    setSaveStatus('Digitando...');
    
    const handler = setTimeout(async () => {
      setSaveStatus('Salvando...');
      try {
        await autoSaveDraft();
        setSaveStatus(`Salvo local & nuvem`);
      } catch (err) {
        setSaveStatus('Salvo local (Aguardando Rede)');
      }
    }, 3000);

    return () => clearTimeout(handler);
  }, [formData, aiOutput, isDataLoaded]);

  React.useEffect(() => {
    if (caseId) {
      const loadCase = async () => {
        setLoading(true);
        try {
          const response = await api.get(`/api/cases/${caseId}`);
          const data = response.data;
          if (data) {
            const pt = data.patient || {};
            const cl = data.clinical || {};
            const aiData = data.ai || {};
            
            setFormData({
              authorName: data.authorName || "", institution: data.institution || "", 
              ethicsApproval: true, patientAge: pt.age || "", 
              patientGender: pt.gender || "", patientProfession: pt.profession || "",
              complaint: cl.complaint || "", history: cl.history || "", 
              physicalExam: cl.physicalExam || "", diagnostics: cl.diagnostics || "", 
              intervention: cl.intervention || "", outcome: cl.outcome || "", 
              keywords: cl.keywords || "", isSurgical: cl.isSurgical || false, 
              clavienDindo: cl.clavienDindo || "", imageUrls: data.images ? data.images.map(img => img.publicUrl) : []
            });
            if (data.status === 'generated' || data.status === 'finalized') {
              setAiOutput({
                advisorFeedback: aiData.advisorFeedback || "", title: aiData.title || "",
                submissionSummary: aiData.submissionSummary || aiData.abstract || "", draftArticle: aiData.draftArticle || "",
                posterContent: aiData.posterContent || "", posterWidth: "1080", posterHeight: "1920"
              });
              setAiGenerated(true);
              setStep(4);
            }
            setIsDataLoaded(true); // Dados carregados com sucesso
          }
        } catch (err) {
          console.error("Failed to load case", err);
        } finally {
          setLoading(false);
        }
      };
      loadCase();
    }
  }, [caseId]);

  const steps = [
    { id: 'meta', title: 'Autoria e Ética', icon: <User size={18} /> },
    { id: 'patient', title: 'Paciente e HMA', icon: <Activity size={18} /> },
    { id: 'exam', title: 'Exame e Diagnóstico', icon: <Stethoscope size={18} /> },
    { id: 'treatment', title: 'Conduta e Evolução', icon: <ClipboardList size={18} /> },
    { id: 'validation', title: 'Geração e Validação', icon: <Send size={18} /> }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAiChange = (field, value) => {
    setAiOutput(prev => ({ ...prev, [field]: value }));
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const generateAiReport = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/generate-case`, formData);
      const data = response.data;
      
      setAiOutput(prev => ({
        ...prev,
        advisorFeedback: data.advisor_feedback || "Nenhum feedback adicional.",
        title: data.title || `Relato de Caso: ${formData.complaint}`,
        submissionSummary: data.submission_summary || "",
        draftArticle: data.draft_article || "",
        posterContent: data.poster_content || ""
      }));
      setAiGenerated(true);
      setStep(4);
    } catch (error) {
      console.error("Erro ao gerar caso", error);
      alert("Houve um erro de comunicação com o servidor de IA. Verifique se o backend está rodando e a API Key configurada.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (sectionKey, oldText) => {
    const instruction = prompt(
      "O que você deseja mudar nesta seção?\n\nEx: 'Use mais jargão médico', 'Reduza pela metade', 'Adicione o aspecto de oclusão'", 
      "Melhore a fluidez clínica e use vocabulário mais robusto."
    );
    if (!instruction) return;
    
    setSaveStatus('Refinando via IA...');
    try {
      const { data } = await api.post(`/api/cases/${currentCaseId}/refine`, {
        section: sectionKey,
        oldText: oldText,
        instruction: instruction
      });
      setAiOutput(prev => ({ ...prev, [sectionKey]: data.newText }));
      setSaveStatus('Refinamento concluído!');
    } catch (err) {
      alert('Erro ao refinar o texto.');
      setSaveStatus('Erro no Refinamento');
    }
  };

  const handleDownloadDocx = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/cases/${currentCaseId}/export/docx`, {
        responseType: 'blob' // Importante para arquivos binários!
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Relato_Clinico_OTTO.docx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar arquivo do Microsoft Word. Verifique a API.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/generate-poster-pdf`, {
        title: aiOutput.title,
        authorName: formData.authorName,
        institution: formData.institution,
        posterContent: aiOutput.posterContent,
        width: aiOutput.posterWidth,
        height: aiOutput.posterHeight
      }, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `poster_${formData.authorName.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao gerar PDF", error);
      alert("Houve um erro ao gerar o PDF. Verifique o servidor.");
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension limit to ensure size < 1MB ideally
          const MAX_DIM = 1200;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/webp', 0.8);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      
      // AutoSave obrigatório antes do upload de imagem, para termos o ID do Caso
      let targetCaseId = currentCaseId;
      if (!targetCaseId) {
          const id = await autoSaveDraft();
          if (!id) throw new Error("Não foi possível criar o caso antes do upload");
          targetCaseId = id;
      }

      const compressedBlob = await compressImage(file);
      
      // 1. Pega URL assinada via Backend
      const signRes = await api.post('/api/uploads/sign', {
          filename: file.name,
          contentType: 'image/webp'
      });
      const { uploadUrl, storagePath, publicUrl } = signRes.data;

      // 2. Envia binário direto pro Google Cloud Storage sem token de API (acesso nativo com permissão assinada)
      await fetch(uploadUrl, {
          method: 'PUT',
          body: compressedBlob,
          headers: { 'Content-Type': 'image/webp' }
      });

      // 3. Cadastra metadata da imagem no Caso
      await api.post(`/api/cases/${targetCaseId}/images`, {
          storagePath, publicUrl, caption: 'Upload Clínico'
      });
        
      handleInputChange('imageUrls', [...formData.imageUrls, publicUrl]);
    } catch (err) {
      console.error("Erro no upload", err);
      alert("Falha ao enviar a imagem.");
    } finally {
      setLoading(false);
    }
  };

  const autoSaveDraft = async () => {
    try {
      const payload = {
        authorName: formData.authorName,
        institution: formData.institution,
        patient: {
          age: formData.patientAge,
          gender: formData.patientGender,
          profession: formData.patientProfession
        },
        clinical: {
          complaint: formData.complaint,
          history: formData.history,
          physicalExam: formData.physicalExam,
          diagnostics: formData.diagnostics,
          intervention: formData.intervention,
          outcome: formData.outcome,
          keywords: formData.keywords,
          isSurgical: formData.isSurgical,
          clavienDindo: formData.clavienDindo
        },
        status: aiGenerated ? 'generated' : 'draft',
      };

      if (currentCaseId) {
        await api.patch(`/api/cases/${currentCaseId}`, payload);
        return currentCaseId;
      } else {
        const { data } = await api.post('/api/cases', payload);
        if (data.id) {
          setCurrentCaseId(data.id);
          return data.id;
        }
      }
    } catch (e) {
      console.error("Autosave failed", e);
      throw e;
    }
  };

  const handleNextStep = async () => {
    await autoSaveDraft();
    setStep(s => Math.min(steps.length - 1, s + 1));
  };

  const handleSaveToDatabase = async () => {
    try {
      const payload = {
        authorName: formData.authorName,
        institution: formData.institution,
        status: 'generated',
        patient: {
          age: formData.patientAge,
          gender: formData.patientGender,
          profession: formData.patientProfession
        },
        clinical: {
          complaint: formData.complaint,
          history: formData.history,
          physicalExam: formData.physicalExam,
          diagnostics: formData.diagnostics,
          intervention: formData.intervention,
          outcome: formData.outcome,
          keywords: formData.keywords,
          isSurgical: formData.isSurgical,
          clavienDindo: formData.clavienDindo
        },
        ai: {
          advisorFeedback: aiOutput.advisorFeedback,
          title: aiOutput.title,
          submissionSummary: aiOutput.submissionSummary,
          draftArticle: aiOutput.draftArticle,
          posterContent: aiOutput.posterContent
        }
      };

      if (currentCaseId) {
        await api.patch(`/api/cases/${currentCaseId}`, payload);
      } else {
        const { data } = await api.post('/api/cases', payload);
        setCurrentCaseId(data.id);
      }
      
      alert("Relato gravado com sucesso no Banco de Dados!");
    } catch (error) {
      console.error("Erro ao salvar no banco:", error);
      alert("Erro ao gravar dados.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack} className="mr-4 px-3 py-1.5 h-auto text-sm">
            <ChevronLeft size={16} /> Voltar
          </Button>
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Criador de Relato de Caso</h1>
            <div className="flex items-center gap-2">
              <p className="text-slate-500 text-xs font-medium">Modelos CARE & SCARE</p>
              {saveStatus && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${saveStatus.includes('Erro') || saveStatus.includes('Aguardando') ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                  {saveStatus.includes('Salvando') ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                  {saveStatus}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => window.open("https://www.care-statement.org/checklist", "_blank")}>
            <FileText size={14} className="mr-1" /> CARE
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("https://www.scareguideline.com/", "_blank")}>
            <FileText size={14} className="mr-1" /> SCARE
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("https://www.aborlccf.org.br/eventos/normas", "_blank")}>
            <AlertCircle size={14} className="mr-1" /> Editais ORL
          </Button>
          <Button variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={() => setShowReferences(true)}>
            <BookOpen size={14} className="mr-1" /> Base do RAG
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulário Interativo */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="p-4 flex justify-between overflow-x-auto">
            {steps.map((s, idx) => (
              <div key={s.id} className={`flex items-center gap-2 px-3 py-1 rounded-full whitespace-nowrap ${step === idx ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                {s.icon}
                <span className="text-xs font-bold uppercase tracking-wider">{s.title}</span>
                {idx < steps.length - 1 && <ChevronRight size={14} className="ml-2 text-slate-300" />}
              </div>
            ))}
          </Card>

          <Card className="p-6 md:p-8 min-h-[500px] flex flex-col relative text-left">
            {step === 0 && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-xl font-bold flex items-center gap-2"><User className="text-blue-600" /> Dados Acadêmicos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="Autor Principal" placeholder="Nome completo" value={formData.authorName} onChange={(v) => handleInputChange('authorName', v)} required />
                  <InputField label="Instituição / Serviço" placeholder="Ex: Hospital das Clínicas" value={formData.institution} onChange={(v) => handleInputChange('institution', v)} />
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-left">
                  <AlertCircle className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-bold">Aviso Ético (Mandatório):</p>
                    <p className="mb-2">Ao prosseguir, você confirma que possui o Termo de Consentimento Livre e Esclarecido (TCLE) assinado pelo paciente ou aprovação do CEP.</p>
                    <label className="flex items-center gap-2 cursor-pointer font-bold">
                      <input type="checkbox" checked={formData.ethicsApproval} onChange={(e) => handleInputChange('ethicsApproval', e.target.checked)} className="rounded text-blue-600" />
                      Eu declaro conformidade ética.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-xl font-bold flex items-center gap-2"><Activity className="text-blue-600" /> O Caso Clínico</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InputField label="Idade" placeholder="Ex: 45" value={formData.patientAge} onChange={(v) => handleInputChange('patientAge', v)} />
                  <InputField label="Sexo" placeholder="M / F" value={formData.patientGender} onChange={(v) => handleInputChange('patientGender', v)} />
                  <div className="md:col-span-2">
                    <InputField label="Profissão" placeholder="Ex: Professor, Pedreiro..." value={formData.patientProfession} onChange={(v) => handleInputChange('patientProfession', v)} />
                  </div>
                </div>
                <TextAreaField label="Queixa Principal (QP)" placeholder="Relate o sintoma e o tempo de duração..." value={formData.complaint} onChange={(v) => handleInputChange('complaint', v)} />
                <TextAreaField label="História da Moléstia Atual (HMA)" placeholder="Evolução, tratamentos prévios e comorbidades..." value={formData.history} onChange={(v) => handleInputChange('history', v)} />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-xl font-bold flex items-center gap-2"><Stethoscope className="text-blue-600" /> Investigação</h2>
                <TextAreaField label="Exame Físico Especializado (Otoscopia, Rinoscopia, Laringoscopia)" placeholder="Descreva detalhadamente..." value={formData.physicalExam} onChange={(v) => handleInputChange('physicalExam', v)} />
                <TextAreaField label="Exames Complementares" placeholder="Audiometria (limiares), TC, RM, Laboratório..." value={formData.diagnostics} onChange={(v) => handleInputChange('diagnostics', v)} />
                
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Imagens do Caso (Minimizado via PWA)</h3>
                  {formData.imageUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {formData.imageUrls.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 border rounded overflow-hidden">
                          <img src={url} alt="Clinical image" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="p-4 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-lg flex flex-col items-center justify-center gap-2 text-blue-500 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all">
                    <ImageIcon size={32} />
                    <span className="text-sm font-medium text-center">Faça upload de fotos ou exames.<br/> As imagens serão comprimidas automaticamente para menos de 1MB.</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="text-blue-600" /> Resolução</h2>
                <TextAreaField label="Conduta e Intervenção" placeholder="Descrição cirúrgica, via de acesso ou protocolo..." value={formData.intervention} onChange={(v) => handleInputChange('intervention', v)} />
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-3 text-left">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input type="checkbox" checked={formData.isSurgical} onChange={(e) => handleInputChange('isSurgical', e.target.checked)} className="rounded text-blue-600" />
                      Este é um Caso Cirúrgico (Ativa Diretrizes SCARE)
                    </label>
                    <p className="text-xs text-slate-500 ml-6 mt-1 mb-2 leading-relaxed">
                      *O SCARE <strong>(Surgical CAse REport)</strong> é o protocolo internacional para padronizar relatos cirúrgicos.<br/> 
                      Ative-o se houve procedimento invasivo. Ele guiará a IA a descrever a técnica, profilaxia antimicrobiana, dispositivos médicos implantáveis utilizados, via de acesso e possíveis complicações per-operatórias.*
                    </p>
                  </div>
                  {formData.isSurgical && (
                    <div className="mt-2 animate-in fade-in duration-300">
                      <InputField label="Classificação de Clavien-Dindo (Complicações Cirúrgicas)" placeholder="Ex: Grau I (Antiemético), Grau II, Nenhuma..." value={formData.clavienDindo} onChange={(v) => handleInputChange('clavienDindo', v)} />
                    </div>
                  )}
                </div>
                <TextAreaField label="Evolução e Desfecho" placeholder="Acompanhamento pós-op, status atual..." value={formData.outcome} onChange={(v) => handleInputChange('outcome', v)} />
                <InputField label="Palavras-Chave (MeSH/DeCS)" placeholder="Ex: Sinusite, Endoscopia, Complicações" value={formData.keywords} onChange={(v) => handleInputChange('keywords', v)} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in duration-500 flex-1 flex flex-col">
                {!aiGenerated ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center h-full my-auto">
                    <div className="bg-blue-100 p-6 rounded-full text-blue-600 mb-4 animate-bounce">
                      <Send size={48} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Engenharia Clínica OTTO</h2>
                    <p className="text-slate-500 max-w-md mb-8">
                      A IA processará seus inputs para gerar o formulário CARE completo, traduzir o abstract (Summary) e montar a estrutura do E-Pôster.
                    </p>
                    <Button onClick={generateAiReport} className="h-12 px-10 text-lg">Processar Inteligência Clínica</Button>
                  </div>
                ) : (
                  <div className="space-y-6 text-left">
                    <div className="flex items-center justify-between border-b pb-4">
                      <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                        <CheckCircle /> Validação Human-in-the-Loop
                      </h2>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAiGenerated(false)}>Refazer Inputs</Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadDocx} className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1"><Download size={16} /> Exportar Word (.docx)</Button>
                        <Button variant="success" size="sm" onClick={handleDownloadPdf} className="flex items-center gap-1"><Download size={16} /> PDF Pôster</Button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-1">
                        <Activity size={16} /> AI Clinical Advisor
                      </p>
                      <p className="text-sm text-orange-900">{aiOutput.advisorFeedback}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative group">
                        <div className="absolute top-0 right-0 pt-1 pr-1 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRefine('title', aiOutput.title)} className="text-blue-600 bg-blue-50 py-1 px-2 rounded-md hover:bg-blue-100 flex items-center gap-1 text-xs border border-blue-100 cursor-pointer"><Wand2 size={12}/> Refinar IA</button>
                        </div>
                        <label className="text-xs font-bold text-slate-400 uppercase">1. Título Padrão</label>
                        <input className="w-full p-2 border border-slate-300 rounded font-bold" value={aiOutput.title} onChange={(e) => setAiOutput({...aiOutput, title: e.target.value})} />
                      </div>
                      
                      <div className="relative group">
                        <div className="absolute top-0 right-0 pt-1 pr-1 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRefine('submissionSummary', aiOutput.submissionSummary)} className="text-blue-600 bg-blue-50 py-1 px-2 rounded-md hover:bg-blue-100 flex items-center gap-1 text-xs border border-blue-100 cursor-pointer"><Wand2 size={12}/> Refinar IA</button>
                        </div>
                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Languages size={14} /> 2. Submission Summary (Resumo de Inscrição)</label>
                        <textarea className="w-full p-3 border border-slate-300 rounded text-sm font-serif h-32" value={aiOutput.submissionSummary} onChange={(e) => setAiOutput({...aiOutput, submissionSummary: e.target.value})} />
                      </div>

                      <div className="relative group">
                        <div className="absolute top-0 right-0 pt-1 pr-1 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRefine('draftArticle', aiOutput.draftArticle)} className="text-blue-600 bg-blue-50 py-1 px-2 rounded-md hover:bg-blue-100 flex items-center gap-1 text-xs border border-blue-100 cursor-pointer"><Wand2 size={12}/> Refinar IA</button>
                        </div>
                        <label className="text-xs font-bold text-slate-400 uppercase">3. Artigo Completo (CARE / SCARE)</label>
                        <textarea className="w-full p-3 border border-slate-300 rounded text-sm h-64" value={aiOutput.draftArticle} onChange={(e) => setAiOutput({...aiOutput, draftArticle: e.target.value})} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && (
              <div className="mt-8 pt-4 border-t flex justify-between">
                <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
                  <ChevronLeft size={18} /> Anterior
                </Button>
                {step < 4 && (
                  <Button 
                    onClick={handleNextStep}
                    disabled={step === 0 && (!formData.authorName || !formData.ethicsApproval)}
                  >
                    Próximo <ChevronRight size={18} />
                  </Button>
                )}
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-blue-600">OTTO SCI está redigindo seu caso...</p>
                <p className="text-xs text-slate-500 mt-2 italic text-center max-w-xs">Aplicando Linguagem Médica Formal e estruturando o checklist CARE.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Lado Direito: Pôster Preview */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Eye size={18} /> Preview do E-Pôster</h3>
            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-500 uppercase tracking-tighter">1080x1920 PDF</span>
          </div>
          
          <div className="aspect-[9/16] w-full bg-white shadow-lg border border-slate-200 rounded-lg overflow-hidden flex flex-col p-[4%] text-[10px] leading-tight select-none">
            <div className="text-center mb-4 space-y-1">
              <h4 className="font-bold text-blue-900 text-sm uppercase leading-tight line-clamp-3">
                {aiOutput.title || "TÍTULO DO TRABALHO CIENTÍFICO"}
              </h4>
              <p className="font-bold text-slate-700">{formData.authorName || "Nome do Autor"}</p>
              <p className="text-slate-500 italic text-[8px]">{formData.institution || "Instituição"}</p>
              <div className="h-px bg-slate-200 w-full mt-2"></div>
            </div>
            
            <div className="flex-1 space-y-3">
              <section>
                <h5 className="font-bold text-blue-700 uppercase border-b border-blue-100 mb-1">Apresentação do Caso</h5>
                <p className="text-slate-600 line-clamp-6">{formData.history || "História clínica..."}</p>
              </section>
              <section>
                <h5 className="font-bold text-blue-700 uppercase border-b border-blue-100 mb-1">Exames e Conduta</h5>
                <p className="mt-1 text-slate-600 line-clamp-4">{formData.intervention || "Descreva a conduta..."}</p>
              </section>
            </div>
            <div className="mt-auto pt-2 border-t text-[8px] flex justify-between text-slate-400">
              <span>GERADOR OTTO CASES</span>
              <span>Uso Acadêmico</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <InputField label="Largura (px)" value={aiOutput.posterWidth} onChange={(v) => setAiOutput({...aiOutput, posterWidth: v})} />
              <InputField label="Altura (px)" value={aiOutput.posterHeight} onChange={(v) => setAiOutput({...aiOutput, posterHeight: v})} />
            </div>
            <Button variant="primary" className="w-full text-sm" onClick={handleDownloadPdf}>
              <Download size={16} /> Baixar PDF do Pôster
            </Button>
          </div>
        </div>
      </main>

      {/* Modal de Referências do RAG */}
      {showReferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <BookOpen className="text-blue-600" size={20} /> Base de Conhecimento RAG (Otorrino)
              </h2>
              <button onClick={() => setShowReferences(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-600 mb-4">
                A Inteligência Artificial desta plataforma utiliza o framework <strong>RAG (Retrieval-Augmented Generation)</strong> e <strong>Few-Shot Prompting</strong> ancorado nas referências de padrão-ouro abaixo:
              </p>
              <ul className="space-y-3">
                {[
                  "EPOS 2020: European Position Paper on Rhinosinusitis and Nasal Polyps",
                  "Tratado de Otorrinolaringologia e Cirurgia Cérvico-Facial da ABORL-CCF",
                  "V Consenso Brasileiro sobre Rinites 2024",
                  "Diretriz Brasileira para Omalizumabe em Rinossinusite Crônica com Pólipo Nasal",
                  "100 Cases In ENT (Modelos de submissão acadêmica)",
                  "CARE Guidelines: The CARE Statements and Checklist",
                  "SCARE Guidelines: Surgical CAse REport",
                  "The Laryngoscope (The Triological Society) - Persona Q1",
                  "Brazilian Journal of Otorhinolaryngology (BJORL) - Persona Nacional",
                  "Adaptação Transcultural da Terminologia Anatômica Nasossinusal para o Português"
                ].map((ref, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <span className="font-bold text-blue-600 shrink-0 w-5">{idx + 1}.</span>
                    <span className="text-slate-700">{ref}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 border-t bg-slate-50 text-right">
              <Button onClick={() => setShowReferences(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
