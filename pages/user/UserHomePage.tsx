import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import { getPaginatedCampaigns, addLocationUpdate } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Campaign } from '../../types';
import { MagnifyingGlassIcon } from '../../components/icons/MagnifyingGlassIcon';
import { TagIcon } from '../../components/icons/TagIcon';
import LoadingSpinner from '../../components/LoadingSpinner';
import PaginationControls from '../../components/PaginationControls';

const PAGE_SIZE = 9;

// Função para calcular a distância entre duas coordenadas em metros (Haversine)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // em metros
}

const UserHomePage: React.FC = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("Buscando sua localização para encontrar campanhas...");
  const locationWatchId = React.useRef<number | null>(null);

  const fetchCampaigns = useCallback(async (page: number, search: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, count } = await getPaginatedCampaigns(page, PAGE_SIZE, {
        status: 'active',
        searchQuery: search,
        researcherId: user.profileId,
        companyId: 'all',
      });
      setCampaigns(data);
      setTotalCampaigns(count);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns(currentPage, searchQuery);
  }, [currentPage, searchQuery, fetchCampaigns]);

  useEffect(() => {
    const startTracking = () => {
        if (navigator.geolocation) {
            locationWatchId.current = navigator.geolocation.watchPosition(
                (position) => {
                    if (user) {
                        const { latitude, longitude } = position.coords;
                        setCurrentPosition({ latitude, longitude });
                        setLocationMessage(''); // Limpa a mensagem quando a localização é obtida
                        addLocationUpdate(user.profileId, latitude, longitude);
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    if (error.code === 1) { // PERMISSION_DENIED
                        setLocationMessage("Para ver campanhas próximas, habilite a permissão de localização.");
                        alert("Para usar o rastreamento, por favor, habilite a permissão de localização para este site nas configurações do seu navegador.");
                    } else {
                        setLocationMessage("Não foi possível obter sua localização.");
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0,
                }
            );
        } else {
          setLocationMessage("Geolocalização não é suportada por este navegador.");
          alert("Geolocalização não é suportada por este navegador.");
        }
    };

    if (user) {
      startTracking();
    }

    return () => {
        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
        }
    };
  }, [user]);

  const visibleCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
        // Se a campanha não tem pontos de ativação, sempre mostra
        if (!campaign.activationPoints || campaign.activationPoints.length === 0) {
            return true;
        }
        // Se tem pontos de ativação, mas a localização do usuário ainda não foi obtida, não mostra
        if (!currentPosition) {
            return false;
        }
        // Verifica se o usuário está dentro do raio de PELO MENOS UM dos pontos de ativação
        return campaign.activationPoints.some(point => {
            const distance = getDistance(
                currentPosition.latitude,
                currentPosition.longitude,
                point.latitude,
                point.longitude
            );
            return distance <= point.radius;
        });
    });
  }, [campaigns, currentPosition]);

  const totalPages = Math.ceil(totalCampaigns / PAGE_SIZE);

  useEffect(() => {
      setCurrentPage(0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-background text-light-text dark:text-dark-text">
      <Header title="Painel do Pesquisador" />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        <section className="mb-12">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">Minhas Campanhas Disponíveis</h2>
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Buscar campanha..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 bg-light-background dark:bg-dark-card py-2 pr-3 pl-10 border border-light-border dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-light-primary"
                />
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-10">
                <LoadingSpinner text="Carregando campanhas" />
            </div>
          ) : visibleCampaigns.length > 0 ? (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCampaigns.map((campaign) => {
                    const responseCount = (campaign as any).responseCount || 0;
                    const isGoalMet = campaign.responseGoal > 0 && responseCount >= campaign.responseGoal;
                    const progressPercentage = campaign.responseGoal > 0 ? Math.min((responseCount / campaign.responseGoal) * 100, 100) : 0;

                    return (
                    <div key={campaign.id} className="bg-light-background dark:bg-dark-card p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-light-primary">{campaign.name}</h3>
                            <span className="flex-shrink-0 ml-2 text-xs bg-gray-200 dark:bg-dark-background text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full flex items-center gap-1.5">
                                <TagIcon className="h-3 w-3" />
                                {campaign.theme}
                            </span>
                        </div>

                        <p className="mb-4 text-gray-600 dark:text-gray-400 flex-grow">{campaign.description}</p>
                        
                        <div className="mb-4">
                        <div className="flex justify-between items-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                            <span>Progresso</span>
                            <span>{responseCount} / {campaign.responseGoal}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div 
                                className={`h-2.5 rounded-full transition-all duration-500 ${isGoalMet ? 'bg-success' : 'bg-gradient-to-r from-gradient-cyan to-gradient-blue'}`} 
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                        </div>

                        <Link
                        to={`/user/survey/${campaign.id}`}
                        className={`inline-block w-full text-center font-bold py-2 px-4 rounded-lg transition-opacity ${
                            isGoalMet
                            ? 'bg-success text-white cursor-not-allowed'
                            : 'bg-gradient-to-r from-gradient-cyan to-gradient-blue text-white hover:opacity-90'
                        }`}
                        onClick={(e) => isGoalMet && e.preventDefault()}
                        aria-disabled={isGoalMet}
                        >
                        {isGoalMet ? 'Meta Atingida' : 'Iniciar Pesquisa'}
                        </Link>
                    </div>
                    )
                })}
                </div>
                {totalPages > 1 && (
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalCount={totalCampaigns}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </>
          ) : (
            <div className="text-center py-10 bg-light-background dark:bg-dark-card rounded-lg shadow-md">
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    {locationMessage || (searchQuery ? 'Nenhuma campanha encontrada com esse nome.' : 'Nenhuma campanha disponível na sua localização atual.')}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    {searchQuery ? 'Tente buscar por outro termo.' : 'Aproxime-se de um ponto de ativação ou entre em contato com um administrador.'}
                </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default UserHomePage;