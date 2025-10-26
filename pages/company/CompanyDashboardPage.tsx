// pages/company/CompanyDashboardPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '../../components/Header';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getResponses, getFullCampaigns, getCompanyDashboardStats, getVouchers, getCompanyById } from '../../services/api';
import type { SurveyResponse, Campaign, Voucher, Company } from '../../types';
import { QuestionType } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import { PrinterIcon } from '../../components/icons/PrinterIcon';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { DocumentArrowDownIcon } from '../../components/icons/DocumentArrowDownIcon';
import { DocumentTextIcon } from '../../components/icons/DocumentTextIcon';
import { UserGroupIcon } from '../../components/icons/UserGroupIcon';
import { StarIcon } from '../../components/icons/StarIcon';
import PaginationControls from '../../components/PaginationControls';
import { CompanyVoucherManager } from '../../components/CompanyVoucherManager';

const PAGE_SIZE = 10;
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => {
    return (
        <div className="bg-light-background dark:bg-dark-card p-6 rounded-lg shadow-md flex items-center gap-6">
            <div className="bg-light-primary/20 text-light-primary p-4 rounded-full">
                <Icon className="h-8 w-8" />
            </div>
            <div>
                <p className="text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-3xl font-bold">{value}</p>
            </div>
        </div>
    );
}

const CompanyDashboardPage: React.FC = () => {
  const [paginatedResponses, setPaginatedResponses] = useState<SurveyResponse[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [allResponses, setAllResponses] = useState<SurveyResponse[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeAgeIndex, setActiveAgeIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [stats, setStats] = useState({ totalResponses: 0, participatingCampaigns: 0 });
  const [selfCompany, setSelfCompany] = useState<Company | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if(!user) return;
        
        const [campaignsData, allResponsesDataResult, companyStats, vouchersData, companyProfile] = await Promise.all([
            getFullCampaigns(),
            getResponses(0, 10000), // Fetch all for charts
            getCompanyDashboardStats(user.profileId),
            getVouchers(),
            getCompanyById(user.profileId),
        ]);

        setSelfCompany(companyProfile);
        setCampaigns(campaignsData);
        setAllResponses(allResponsesDataResult.data);
        setStats(companyStats);
        setVouchers(vouchersData);

      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
      const loadPaginatedResponses = async () => {
          if (!user) return;
          const { data, count } = await getResponses(currentPage, PAGE_SIZE);
          const companyCampaignIds = campaigns.filter(c => c.companyIds.includes(user.profileId)).map(c => c.id);
          setPaginatedResponses(data.filter(r => companyCampaignIds.includes(r.campaignId)));
          setTotalResponses(count); // Note: This count is for ALL responses, might need adjustment if filtering is strict
      }
      if (!isLoading) {
          loadPaginatedResponses();
      }
  }, [currentPage, campaigns, user, isLoading]);
  
  const { ageData, averageSatisfaction } = useMemo(() => {
    // Filter responses for this company's campaigns first
    const companyCampaignIds = campaigns.filter(c => user && c.companyIds.includes(user.profileId)).map(c => c.id);
    const companyResponses = allResponses.filter(r => companyCampaignIds.includes(r.campaignId));
    
    const satisfactionQuestionIdMap = new Map<string, string>();
    campaigns
        .filter(c => companyCampaignIds.includes(c.id))
        .forEach(campaign => {
            const satisfactionQuestion = campaign.questions.find(q => q.type === QuestionType.RATING);
            if (satisfactionQuestion) {
                satisfactionQuestionIdMap.set(campaign.id, satisfactionQuestion.id);
            }
    });

    let totalSatisfactionScore = 0;
    let satisfactionResponseCount = 0;
    
    companyResponses.forEach(response => {
        // Average Satisfaction calculation
        const satisfactionQuestionId = satisfactionQuestionIdMap.get(response.campaignId);
        if (satisfactionQuestionId) {
            const answer = response.answers.find(a => a.questionId === satisfactionQuestionId)?.answer;
            const score = Number(answer);
            if (score >= 1 && score <= 5) {
                totalSatisfactionScore += score;
                satisfactionResponseCount++;
            }
        }
    });
    
    const averageSatisfaction = satisfactionResponseCount > 0 
        ? (totalSatisfactionScore / satisfactionResponseCount).toFixed(1) 
        : 'N/A';
    
    // Age Data calculation
    const ageRanges: Record<string, number> = { '-18': 0, '18-24': 0, '25-44': 0, '45+': 0 };
    companyResponses.forEach(response => {
        if (response.userAge && ageRanges.hasOwnProperty(response.userAge)) {
            ageRanges[response.userAge]++;
        }
    });
    const ageData = Object.entries(ageRanges).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
        
    return { ageData, averageSatisfaction };

  }, [allResponses, campaigns, user]);

  const totalAgeRespondents = useMemo(() => ageData.reduce((sum, entry) => sum + entry.value, 0), [ageData]);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveAgeIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveAgeIndex(null);
  }, []);

  const totalPages = Math.ceil(totalResponses / PAGE_SIZE);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text(`Relatório - ${user?.name || 'Empresa'}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado em: ${formattedDate} às ${formattedTime}`, 14, 30);

    const tableHead = [['Nome', 'Idade', 'Telefone', 'Data', 'Hora']];
    const tableBody = allResponses.map(r => [
        r.userName || 'N/A',
        r.userAge?.toString() || 'N/A',
        r.userPhone || 'N/A',
        r.timestamp.toLocaleDateString('pt-BR'),
        r.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    ]);

    (doc as any).autoTable({
        head: tableHead,
        body: tableBody,
        startY: 40,
        headStyles: { fillColor: [59, 130, 246] },
        theme: 'grid',
    });

    doc.save('dados_respondentes.pdf');
  };
  
  const exportToCSV = () => {
    const headers = '"Nome","Idade","Telefone","Data","Hora"';
    const csvRows = allResponses.map(r => {
        const name = `"${(r.userName || '').replace(/"/g, '""')}"`;
        const age = r.userAge || 'N/A';
        const phone = `"${(r.userPhone || '').replace(/"/g, '""')}"`;
        const date = r.timestamp.toLocaleDateString('pt-BR');
        const time = r.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return [name, age, phone, date, time].join(',');
    });
    
    const csvString = [headers, ...csvRows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "dados_respondentes.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmExport = () => {
    exportToPDF();
    setIsPdfModalOpen(false);
    setToastMessage('PDF exportado com sucesso!');
    setShowSuccessToast(true);
    setTimeout(() => {
        setShowSuccessToast(false);
    }, 3000);
  };
  
  const handleConfirmCsvExport = () => {
    exportToCSV();
    setIsCsvModalOpen(false);
    setToastMessage('CSV exportado com sucesso!');
    setShowSuccessToast(true);
    setTimeout(() => {
        setShowSuccessToast(false);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-background text-light-text dark:text-dark-text">
        <Header title="Dashboard da Empresa" />
        <main className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-grow items-center justify-center">
            <LoadingSpinner text="Carregando dados" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-background text-light-text dark:text-dark-text">
      <Header title="Dashboard da Empresa" />
      <main className="p-4 sm:p-8 max-w-screen-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Análise de Respostas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard title="Total de Respostas" value={stats.totalResponses} icon={DocumentTextIcon} />
            <StatCard title="Campanhas Participantes" value={stats.participatingCampaigns} icon={UserGroupIcon} />
            <StatCard title="Média de Satisfação" value={averageSatisfaction} icon={StarIcon} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 bg-light-background dark:bg-dark-card p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">Faixa Etária dos Respondentes</h3>
                 {ageData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="relative w-full h-[250px] md:h-auto">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={ageData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                        onMouseLeave={onPieLeave}
                                    >
                                        {ageData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={COLORS[index % COLORS.length]}
                                                className="transition-opacity duration-200"
                                                style={{ opacity: activeAgeIndex === null || activeAgeIndex === index ? 1 : 0.3, outline: 'none' }}
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    {activeAgeIndex !== null && ageData[activeAgeIndex] ? (
                                        <>
                                            <p className="text-2xl font-bold">
                                                {totalAgeRespondents > 0 
                                                    ? `${((ageData[activeAgeIndex].value / totalAgeRespondents) * 100).toFixed(0)}%`
                                                    : '0%'}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{ageData[activeAgeIndex].name}</p>
                                            <p className="text-xs text-gray-400">
                                                ({ageData[activeAgeIndex].value} {ageData[activeAgeIndex].value > 1 ? 'respondentes' : 'respondente'})
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-3xl font-bold">{totalAgeRespondents}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ul className="space-y-2">
                             {ageData.map((entry, index) => {
                                const percentage = totalAgeRespondents > 0 
                                    ? ((entry.value / totalAgeRespondents) * 100).toFixed(0) 
                                    : 0;
                                return (
                                    <li 
                                        key={`legend-${index}`}
                                        className="flex items-center text-sm p-2 rounded-md transition-colors cursor-pointer"
                                        onMouseEnter={() => onPieEnter(null, index)}
                                        onMouseLeave={onPieLeave}
                                        style={{ backgroundColor: activeAgeIndex === index ? 'var(--primary-color-light)' : 'transparent' }}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                            <span>{entry.name}</span>
                                        </div>
                                        <span className="font-semibold ml-auto pl-2 whitespace-nowrap">{percentage}% ({entry.value})</span>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                 ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Nenhum dado de faixa etária para exibir.
                    </div>
                )}
            </div>
            <div className="lg:col-span-3 bg-light-background dark:bg-dark-card p-6 rounded-lg shadow-md">
                {selfCompany ? (
                    <CompanyVoucherManager company={selfCompany} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <LoadingSpinner text="Carregando vouchers" />
                    </div>
                )}
            </div>
        </div>
        <div className="mt-8 bg-light-background dark:bg-dark-card p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-bold">Dados dos Respondentes (Total: {totalResponses})</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPdfModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <PrinterIcon className="h-5 w-5" />
                        Exportar PDF
                    </button>
                    <button
                        onClick={() => setIsCsvModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                        Exportar CSV
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-light-background dark:bg-dark-card">
                        <tr className="border-b border-light-border dark:border-dark-border">
                            <th className="p-3 font-semibold">Nome</th>
                            <th className="p-3 font-semibold">Idade</th>
                            <th className="p-3 font-semibold">Telefone</th>
                            <th className="p-3 font-semibold no-print-col">Data</th>
                            <th className="p-3 font-semibold no-print-col">Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedResponses.map(response => (
                             <tr key={response.id} className="border-b border-light-border dark:border-dark-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-dark-background/30">
                                <td className="p-3">{response.userName}</td>
                                <td className="p-3">{response.userAge || 'N/A'}</td>
                                <td className="p-3">{response.userPhone || 'N/A'}</td>
                                <td className="p-3 no-print-col">{response.timestamp.toLocaleDateString('pt-BR')}</td>
                                <td className="p-3 no-print-col">{response.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalCount={totalResponses}
                    pageSize={PAGE_SIZE}
                />
            )}
        </div>
      </main>

      <Modal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} title="Confirmar Exportação">
        <p>Deseja realmente exportar os dados de todos os {allResponses.length} respondentes para PDF?</p>
        <div className="flex justify-end gap-4 mt-6">
            <button onClick={() => setIsPdfModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg hover:opacity-90">Cancelar</button>
            <button onClick={handleConfirmExport} className="px-4 py-2 bg-gradient-to-r from-gradient-cyan to-gradient-blue text-white font-bold rounded-lg hover:opacity-90">Confirmar e Baixar</button>
        </div>
      </Modal>
      
      <Modal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} title="Confirmar Exportação">
        <p>Deseja realmente exportar os dados de todos os {allResponses.length} respondentes para CSV?</p>
        <div className="flex justify-end gap-4 mt-6">
            <button onClick={() => setIsCsvModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg hover:opacity-90">Cancelar</button>
            <button onClick={handleConfirmCsvExport} className="px-4 py-2 bg-gradient-to-r from-gradient-cyan to-gradient-blue text-white font-bold rounded-lg hover:opacity-90">Confirmar e Baixar</button>
        </div>
      </Modal>

    {showSuccessToast && (
      <div className="fixed bottom-8 right-8 z-50 bg-success text-white py-3 px-6 rounded-lg shadow-2xl flex items-center gap-3 transition-opacity duration-300">
        <CheckCircleIcon className="h-6 w-6" />
        <p className="font-semibold">{toastMessage}</p>
      </div>
    )}
    </div>
  );
};

export default CompanyDashboardPage;