// pages/admin/CampaignEditorPage.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getFullCampaigns, getCompanies, getResearchers } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { Campaign, Question, Company, Researcher, ActivationPoint } from '../../types';
import { QuestionBuilder } from '../../components/QuestionBuilder';
import { CampaignEditorStepper } from '../../components/CampaignEditorStepper';
import { ArrowLeftIcon } from '../../components/icons/ArrowLeftIcon';
import { UsersIcon } from '../../components/icons/UsersIcon';
import { UserCircleIcon } from '../../components/icons/UserCircleIcon';
import { MagnifyingGlassIcon } from '../../components/icons/MagnifyingGlassIcon';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { TrashIcon } from '../../components/icons/TrashIcon';
import Modal from '../../components/Modal';

const CampaignEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Partial<Campaign>>({
    name: '',
    description: '',
    theme: '',
    lgpdText: 'Seus dados serão usados apenas para fins de pesquisa e não serão compartilhados com terceiros. Ao continuar, você concorda com nossos termos de privacidade.',
    questions: [],
    companyIds: [],
    researcherIds: [],
    responseGoal: 100,
    isActive: false,
    collectUserInfo: false,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    finalRedirectUrl: '',
    activationPoints: [],
  });
  const [step, setStep] = useState(1);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allResearchers, setAllResearchers] = useState<Researcher[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [researcherSearch, setResearcherSearch] = useState('');
  const [companyToToggle, setCompanyToToggle] = useState<Company | null>(null);
  const [isStartTimeEnabled, setIsStartTimeEnabled] = useState(false);
  const [isEndTimeEnabled, setIsEndTimeEnabled] = useState(false);
  const [isActivationPointEnabled, setIsActivationPointEnabled] = useState(false);
  const [isUserInfoToggleModalOpen, setIsUserInfoToggleModalOpen] = useState(false);
  const [newPointRadius, setNewPointRadius] = useState<number>(500);

  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  const isEditing = Boolean(id);

  useEffect(() => {
    const fetchData = async () => {
        const [companiesData, researchersData] = await Promise.all([getCompanies(), getResearchers()]);
        setAllCompanies(companiesData);
        setAllResearchers(researchersData);

        if (isEditing) {
          const campaigns = await getFullCampaigns();
          const existingCampaign = campaigns.find((c) => c.id === id);
          if (existingCampaign) {
            setCampaign(existingCampaign);
            setIsStartTimeEnabled(!!existingCampaign.startTime);
            setIsEndTimeEnabled(!!existingCampaign.endTime);
            setIsActivationPointEnabled(existingCampaign.activationPoints.length > 0);
          } else {
            navigate('/admin/campaigns');
          }
        } else {
            setIsStartTimeEnabled(false);
            setIsEndTimeEnabled(false);
            setIsActivationPointEnabled(false);
        }
    }
    fetchData();
  }, [id, isEditing, navigate]);

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setCampaign(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) : value }));
  };
  
  const handleStartTimeToggle = (enabled: boolean) => {
    setIsStartTimeEnabled(enabled);
    if (!enabled) {
      setCampaign(prev => ({ ...prev, startTime: '' }));
      // Also disable and clear end time if start time is disabled
      setIsEndTimeEnabled(false);
      setCampaign(prev => ({ ...prev, endTime: '' }));
    }
  };

  const handleEndTimeToggle = (enabled: boolean) => {
    setIsEndTimeEnabled(enabled);
    if (!enabled) {
      setCampaign(prev => ({ ...prev, endTime: '' }));
    }
  };


  const handleQuestionsChange = (questions: Question[]) => {
    setCampaign(prev => ({ ...prev, questions }));
  };

  const handleCompanySelection = (companyId: string) => {
    setCampaign(prev => {
      const currentIds = prev.companyIds || [];
      const newIds = currentIds.includes(companyId)
        ? currentIds.filter(cid => cid !== companyId)
        : [...currentIds, companyId];
      return { ...prev, companyIds: newIds };
    });
  };
  
  const handleResearcherSelection = (researcherId: string) => {
    setCampaign(prev => {
      const currentIds = prev.researcherIds || [];
      const newIds = currentIds.includes(researcherId)
        ? currentIds.filter(cid => cid !== researcherId)
        : [...currentIds, researcherId];
      return { ...prev, researcherIds: newIds };
    });
  };

  const requestToggleCompanyActive = (company: Company) => {
    setCompanyToToggle(company);
  };
  
  const requestToggleUserInfo = () => {
    setIsUserInfoToggleModalOpen(true);
  };

  const confirmToggleUserInfo = () => {
    setCampaign(prev => ({ ...prev, collectUserInfo: !prev.collectUserInfo }));
    setIsUserInfoToggleModalOpen(false);
  };

  const confirmToggleCompanyActive = async () => {
    if (companyToToggle) {
        const { error } = await supabase.from('empresas').update({ esta_ativa: !companyToToggle.isActive }).eq('id', companyToToggle.id);
        if (error) {
            alert('Falha ao atualizar status da empresa.');
        } else {
            setAllCompanies(prev => prev.map(c => c.id === companyToToggle.id ? {...c, isActive: !c.isActive} : c));
        }
        setCompanyToToggle(null);
    }
  };

  const handleSave = async () => {
    if (!campaign.name || !campaign.theme) {
      alert('Por favor, preencha o nome e o tema da campanha.');
      setStep(1);
      return;
    }

    const campaignDataForDb = {
        nome: campaign.name,
        descricao: campaign.description || '',
        tema: campaign.theme,
        texto_lgpd: campaign.lgpdText || '',
        esta_ativa: campaign.isActive || false,
        coletar_info_usuario: campaign.collectUserInfo || false,
        meta_respostas: campaign.responseGoal || 100,
        data_inicio: campaign.startDate || null,
        data_fim: campaign.endDate || null,
        hora_inicio: isStartTimeEnabled ? campaign.startTime : null,
        hora_fim: isEndTimeEnabled ? campaign.endTime : null,
        url_redirecionamento_final: campaign.finalRedirectUrl || null,
    };

    let campaignId = id;

    if (isEditing) {
        const { error } = await supabase.from('campanhas').update(campaignDataForDb).eq('id', id);
        if (error) { alert('Falha ao atualizar campanha.'); return; }
    } else {
        const { data, error } = await supabase.from('campanhas').insert(campaignDataForDb).select('id').single();
        if (error || !data) { alert('Falha ao criar campanha.'); return; }
        campaignId = data.id;
    }
    
    if (campaignId) {
        await supabase.from('pontos_ativacao').delete().eq('id_campanha', campaignId);
        if (isActivationPointEnabled && campaign.activationPoints && campaign.activationPoints.length > 0) {
            const pointsToInsert = campaign.activationPoints.map(p => ({
                id_campanha: campaignId,
                latitude: p.latitude,
                longitude: p.longitude,
                raio_metros: p.radius,
            }));
            const { error: pointsError } = await supabase.from('pontos_ativacao').insert(pointsToInsert);
            if (pointsError) {
                alert('Falha ao salvar os pontos de ativação.');
                return;
            }
        }
    }

    if (campaign.questions && campaignId) {
        const questionsToSave = campaign.questions.map((q, index) => ({
            id: q.id.startsWith('q_') ? undefined : q.id,
            id_campanha: campaignId,
            texto: q.text,
            tipo: q.type,
            permitir_multiplas_respostas: q.allowMultipleAnswers || false,
            ordem: index,
        }));
        
        await supabase.from('perguntas').delete().eq('id_campanha', campaignId);
        const { data: savedQuestions, error: questionsError } = await supabase.from('perguntas').insert(questionsToSave.map(({id, ...rest}) => rest)).select();
        
        if (questionsError || !savedQuestions) { 
            alert('Falha ao salvar perguntas.'); 
            console.error(questionsError);
            return; 
        }

        const tempIdToDbIdMap = new Map<string, string>();
        campaign.questions.forEach((q, index) => {
            if (savedQuestions[index]) {
                tempIdToDbIdMap.set(q.id, savedQuestions[index].id);
            }
        });

        const optionsToSave = campaign.questions.flatMap((q, qIndex) =>
            (q.options || []).map((opt, oIndex) => {
                let jumpToDbId: string | null = null;
                if (opt.jumpTo && opt.jumpTo !== 'END_SURVEY') {
                    jumpToDbId = tempIdToDbIdMap.get(opt.jumpTo) || null;
                }
                
                return {
                    id_pergunta: savedQuestions[qIndex].id,
                    valor: opt.value,
                    pular_para_pergunta: jumpToDbId,
                    pular_para_final: opt.jumpTo === 'END_SURVEY',
                    ordem: oIndex
                };
            })
        );

        if (optionsToSave.length > 0) {
            await supabase.from('opcoes_perguntas').delete().in('id_pergunta', savedQuestions.map(q => q.id));
            const { error: optionsError } = await supabase.from('opcoes_perguntas').insert(optionsToSave);
            if (optionsError) {
                console.error("Supabase options error:", optionsError);
                alert('Falha ao salvar opções das perguntas.');
                return;
            }
        }
    }

    if (campaignId) {
        await supabase.from('campanhas_empresas').delete().eq('id_campanha', campaignId);
        if(campaign.companyIds && campaign.companyIds.length > 0) {
            await supabase.from('campanhas_empresas').insert(campaign.companyIds.map(cid => ({id_campanha: campaignId, id_empresa: cid})));
        }

        await supabase.from('campanhas_pesquisadores').delete().eq('id_campanha', campaignId);
        if(campaign.researcherIds && campaign.researcherIds.length > 0) {
            await supabase.from('campanhas_pesquisadores').insert(campaign.researcherIds.map(rid => ({id_campanha: campaignId, id_pesquisador: rid})));
        }
    }

    alert('Campanha salva com sucesso!');
    navigate('/admin/campaigns');
  };
  
  const filteredCompanies = useMemo(() => {
    return allCompanies.filter(company => 
        company.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [allCompanies, companySearch]);

  const filteredResearchers = useMemo(() => {
    return allResearchers.filter(researcher =>
        researcher.name.toLowerCase().includes(researcherSearch.toLowerCase())
    );
  }, [allResearchers, researcherSearch]);

    const handleDeletePoint = (indexToDelete: number) => {
        setCampaign(prev => ({
            ...prev,
            activationPoints: (prev.activationPoints || []).filter((_, index) => index !== indexToDelete)
        }));
    };

    useEffect(() => {
        const L = (window as any).L;
        const mapElement = document.getElementById('activation-map');

        if (isActivationPointEnabled && step === 1 && mapElement && L) {
            if (!mapRef.current) {
                const initialCoords: [number, number] = [-15.793889, -47.882778];
                const initialZoom = 4;
                
                const map = L.map(mapElement).setView(initialCoords, initialZoom);
                mapRef.current = map;
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                map.on('click', (e: any) => {
                    const { lat, lng } = e.latlng;
                    const newPoint: ActivationPoint = {
                        latitude: lat,
                        longitude: lng,
                        radius: newPointRadius,
                    };
                    setCampaign(prev => ({ ...prev, activationPoints: [...(prev.activationPoints || []), newPoint] }));
                });
                setTimeout(() => map.invalidateSize(), 100);
            }

            const map = mapRef.current;
            layersRef.current.forEach(layer => map.removeLayer(layer));
            layersRef.current = [];

            (campaign.activationPoints || []).forEach((point, index) => {
                const latLng: [number, number] = [point.latitude, point.longitude];
                
                const circle = L.circle(latLng, {
                    radius: point.radius,
                    color: '#3B82F6',
                    fillColor: '#3B82F6',
                    fillOpacity: 0.2
                }).addTo(map);
                
                const marker = L.marker(latLng, { draggable: true }).addTo(map);
                marker.on('dragend', (e: any) => {
                    const newLatLng = e.target.getLatLng();
                    setCampaign(prev => {
                        const newPoints = [...(prev.activationPoints || [])];
                        newPoints[index] = { ...newPoints[index], latitude: newLatLng.lat, longitude: newLatLng.lng };
                        return { ...prev, activationPoints: newPoints };
                    });
                });
                
                layersRef.current.push(circle, marker);
            });

            if ((campaign.activationPoints || []).length > 0) {
                const bounds = L.featureGroup(layersRef.current).getBounds();
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }

        } else if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            layersRef.current = [];
        }
    }, [isActivationPointEnabled, step, campaign.activationPoints, newPointRadius]);

  const renderStepContent = () => {
    switch (step) {
      case 1: // Details
        return (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Nome da Campanha</label>
              <input type="text" name="name" id="name" value={campaign.name} onChange={handleDetailsChange} className="w-full input-style" required />
            </div>
            <div>
              <label htmlFor="theme" className="block text-sm font-medium mb-1">Tema</label>
              <input type="text" name="theme" id="theme" value={campaign.theme} onChange={handleDetailsChange} className="w-full input-style" placeholder="Ex: Alimentação, Tecnologia" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label htmlFor="startDate" className="block text-sm font-medium mb-1">Data de Início</label>
                <input type="date" name="startDate" id="startDate" value={campaign.startDate || ''} onChange={handleDetailsChange} className="w-full input-style" />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium mb-1">Data de Fim</label>
                <input type="date" name="endDate" id="endDate" value={campaign.endDate || ''} onChange={handleDetailsChange} className="w-full input-style" />
              </div>
            </div>
            
            <div className="pt-4 border-t border-light-border dark:border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <input 
                            type="checkbox" 
                            id="start-time-toggle" 
                            checked={isStartTimeEnabled}
                            onChange={(e) => handleStartTimeToggle(e.target.checked)}
                            className="h-5 w-5 text-light-primary focus:ring-light-primary rounded"
                        />
                        <label htmlFor="start-time-toggle" className="block text-sm font-medium select-none cursor-pointer">Definir Horário de Início</label>
                    </div>
                    <input type="time" name="startTime" id="startTime" value={campaign.startTime || ''} onChange={handleDetailsChange} className="w-full max-w-xs input-style" disabled={!isStartTimeEnabled} />
                </div>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <input 
                            type="checkbox" 
                            id="end-time-toggle" 
                            checked={isEndTimeEnabled}
                            onChange={(e) => handleEndTimeToggle(e.target.checked)}
                            className="h-5 w-5 text-light-primary focus:ring-light-primary rounded"
                            disabled={!isStartTimeEnabled}
                        />
                        <label htmlFor="end-time-toggle" className={`block text-sm font-medium select-none cursor-pointer ${!isStartTimeEnabled ? 'text-gray-400' : ''}`}>Definir Horário de Fim</label>
                    </div>
                    <input type="time" name="endTime" id="endTime" value={campaign.endTime || ''} onChange={handleDetailsChange} className="w-full max-w-xs input-style" disabled={!isEndTimeEnabled || !isStartTimeEnabled} />
                </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">Descrição</label>
              <textarea name="description" id="description" value={campaign.description} onChange={handleDetailsChange} rows={3} className="w-full input-style" />
            </div>
             <div>
              <label htmlFor="responseGoal" className="block text-sm font-medium mb-1">Meta de Respostas</label>
              <input type="number" name="responseGoal" id="responseGoal" value={campaign.responseGoal} onChange={handleDetailsChange} className="w-full input-style" min="1" />
            </div>
            <div>
              <label htmlFor="lgpdText" className="block text-sm font-medium mb-1">Texto LGPD</label>
              <textarea name="lgpdText" id="lgpdText" value={campaign.lgpdText} onChange={handleDetailsChange} rows={4} className="w-full input-style" />
            </div>

            <div>
              <label htmlFor="finalRedirectUrl" className="block text-sm font-medium mb-1">URL de Redirecionamento Final (Opcional)</label>
              <input type="url" name="finalRedirectUrl" id="finalRedirectUrl" value={campaign.finalRedirectUrl || ''} onChange={handleDetailsChange} className="w-full input-style" placeholder="https://www.exemplo.com" />
              <p className="text-xs text-gray-500 mt-1">O usuário será redirecionado para esta URL após responder, em vez de ver a tela de recompensas.</p>
            </div>

            <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-background">
                <div>
                    <label className="font-medium text-light-text dark:text-dark-text">Coletar Nome e Telefone do Participante</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Se ativado, um formulário será exibido antes da pesquisa.</p>
                </div>
                <ToggleSwitch
                    checked={campaign.collectUserInfo || false}
                    onChange={requestToggleUserInfo}
                />
            </div>
            
            <div className="border border-light-border dark:border-dark-border rounded-lg">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-background rounded-t-lg">
                    <div>
                        <label className="font-medium text-light-text dark:text-dark-text">Ativar Campanha por Proximidade</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">A campanha só será visível para pesquisadores dentro de um raio específico.</p>
                    </div>
                    <ToggleSwitch
                        checked={isActivationPointEnabled}
                        onChange={() => setIsActivationPointEnabled(!isActivationPointEnabled)}
                    />
                </div>
                {isActivationPointEnabled && (
                  <div className="p-4 bg-gray-50 dark:bg-dark-background border-t border-light-border dark:border-dark-border">
                      <label className="block text-sm font-medium mb-1">Pontos de Ativação</label>
                      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-2">
                        {(campaign.activationPoints || []).length > 0 ? (
                            (campaign.activationPoints || []).map((point, index) => (
                                <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-dark-border rounded-md text-xs">
                                    <span>Ponto {index + 1}:</span>
                                    <span className="font-mono">Lat: {point.latitude.toFixed(4)}</span>
                                    <span className="font-mono">Lng: {point.longitude.toFixed(4)}</span>
                                    <span className="font-semibold">Raio: {point.radius}m</span>
                                    <button type="button" onClick={() => handleDeletePoint(index)} className="p-1 text-gray-400 hover:text-error"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 text-center py-2">Clique no mapa para adicionar o primeiro ponto.</p>
                        )}
                      </div>
                      <div className="mb-2">
                        <label htmlFor="newPointRadius" className="block text-xs font-medium mb-1">Raio para novos pontos (metros)</label>
                        <input type="number" id="newPointRadius" value={newPointRadius} onChange={e => setNewPointRadius(parseInt(e.target.value, 10) || 0)} className="w-full input-style" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Clique no mapa para adicionar um novo ponto de ativação. Você pode arrastar os marcadores para ajustar a posição.</p>
                      <div id="activation-map" style={{ height: '350px' }} className="w-full rounded-lg border border-light-border dark:border-dark-border"></div>
                  </div>
                )}
            </div>

          </div>
        );
      case 2: // Questions
        return <QuestionBuilder questions={campaign.questions || []} onChange={handleQuestionsChange} />;
      case 3: // Participants & Team
        return (
          <div className="max-w-2xl mx-auto">
             <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <UsersIcon className="h-6 w-6" />
                    Selecione as Empresas Participantes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">As recompensas (vouchers) dessas empresas serão oferecidas aos usuários que completarem a pesquisa.</p>
                <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar empresa..."
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        className="w-full input-style pl-10"
                    />
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border border-light-border dark:border-dark-border rounded-md p-2">
                  {filteredCompanies.map((company: Company) => (
                    <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-background rounded-md">
                        <label className="flex items-center cursor-pointer flex-grow">
                        <input
                            type="checkbox"
                            checked={(campaign.companyIds || []).includes(company.id)}
                            onChange={() => handleCompanySelection(company.id)}
                            className="h-5 w-5 text-light-primary focus:ring-light-primary rounded"
                            disabled={!company.isActive}
                        />
                        <span className={`ml-3 text-lg ${!company.isActive ? 'text-gray-400 line-through' : ''}`}>{company.name}</span>
                        </label>
                        <ToggleSwitch
                            checked={company.isActive}
                            onChange={() => requestToggleCompanyActive(company)}
                        />
                    </div>
                  ))}
                </div>
            </div>

            <div className="mt-10 pt-6 border-t border-light-border dark:border-dark-border">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <UserCircleIcon className="h-6 w-6" />
                    Pesquisadores Responsáveis
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Selecione quem será responsável por executar esta campanha.</p>
                <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar pesquisador..."
                        value={researcherSearch}
                        onChange={(e) => setResearcherSearch(e.target.value)}
                        className="w-full input-style pl-10"
                    />
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border border-light-border dark:border-dark-border rounded-md p-2">
                    {filteredResearchers.map((researcher: Researcher) => (
                        <label key={researcher.id} className="flex items-center p-3 bg-gray-50 dark:bg-dark-background rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-border">
                            <input
                                type="checkbox"
                                checked={(campaign.researcherIds || []).includes(researcher.id)}
                                onChange={() => handleResearcherSelection(researcher.id)}
                                className="h-5 w-5 text-light-primary focus:ring-light-primary rounded"
                            />
                            <span className="ml-3 text-lg">{researcher.name}</span>
                        </label>
                    ))}
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/campaigns" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <ArrowLeftIcon className="h-6 w-6"/>
        </Link>
        <h1 className="text-3xl font-bold">{isEditing ? 'Editar Campanha' : 'Nova Campanha'}</h1>
      </div>
      
      <Modal isOpen={!!companyToToggle} onClose={() => setCompanyToToggle(null)} title="Confirmar Alteração de Status">
          {companyToToggle && (
              <div>
                  <p>
                      Tem certeza que deseja{' '}
                      <strong className={companyToToggle.isActive ? 'text-error' : 'text-success'}>
                          {companyToToggle.isActive ? 'DESATIVAR' : 'ATIVAR'}
                      </strong>{' '}
                      a empresa "<strong>{companyToToggle.name}</strong>"?
                  </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Essa alteração será refletida em toda a plataforma.
                  </p>
                  <div className="flex justify-end gap-4 mt-6">
                      <button onClick={() => setCompanyToToggle(null)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg hover:opacity-90">Cancelar</button>
                      <button onClick={confirmToggleCompanyActive} className={`px-4 py-2 text-white rounded-lg hover:opacity-90 ${companyToToggle.isActive ? 'bg-error' : 'bg-success'}`}>
                          {companyToToggle.isActive ? 'Sim, Desativar' : 'Sim, Ativar'}
                      </button>
                  </div>
              </div>
          )}
      </Modal>

      <Modal isOpen={isUserInfoToggleModalOpen} onClose={() => setIsUserInfoToggleModalOpen(false)} title="Confirmar Alteração">
          <div>
              <p>
                  Tem certeza que deseja{' '}
                  <strong className={campaign.collectUserInfo ? 'text-error' : 'text-success'}>
                      {campaign.collectUserInfo ? 'DESATIVAR' : 'ATIVAR'}
                  </strong>
                  {' a coleta de nome e telefone do participante?'}
              </p>
              <div className="flex justify-end gap-4 mt-6">
                  <button onClick={() => setIsUserInfoToggleModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg hover:opacity-90">Cancelar</button>
                  <button onClick={confirmToggleUserInfo} className={`px-4 py-2 text-white rounded-lg hover:opacity-90 ${campaign.collectUserInfo ? 'bg-error' : 'bg-success'}`}>
                      {campaign.collectUserInfo ? 'Sim, Desativar' : 'Sim, Ativar'}
                  </button>
              </div>
          </div>
      </Modal>

      <div className="mb-12">
        <CampaignEditorStepper currentStep={step} setStep={setStep} />
      </div>

      <div className="bg-light-background dark:bg-dark-card p-6 sm:p-8 rounded-lg shadow-md">
        {renderStepContent()}
      </div>
      
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="bg-gray-300 dark:bg-gray-600 font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Anterior
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep(s => Math.min(3, s + 1))}
            className="bg-gradient-to-r from-gradient-cyan to-gradient-blue text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            Próximo
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="bg-success text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            {isEditing ? 'Salvar Alterações' : 'Criar Campanha'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CampaignEditorPage;