// services/api.ts
import { supabase } from './supabase';
import type { Admin, Campaign, Company, Researcher, SurveyResponse, Voucher, Question, QuestionOption, LocationPoint, ActivationPoint } from '../types';
import { Gender, QuestionType } from '../types';

const ITEMS_PER_PAGE = 10; // Default page size

// Mappers from DB (snake_case) to App (camelCase)
const mapAdminFromDb = (dbAdmin: any): Admin => ({
    id: dbAdmin.id,
    name: dbAdmin.nome,
    email: dbAdmin.email,
    phone: dbAdmin.telefone,
    dob: dbAdmin.data_nascimento,
    photoUrl: dbAdmin.url_foto,
    isActive: dbAdmin.esta_ativo,
});

// FIX: Export mapCompanyFromDb to be used in other files.
export const mapCompanyFromDb = (dbCompany: any): Company => ({
    id: dbCompany.id,
    name: dbCompany.nome,
    logoUrl: dbCompany.url_logo,
    cnpj: dbCompany.cnpj,
    contactEmail: dbCompany.email_contato,
    contactPhone: dbCompany.telefone_contato,
    contactPerson: dbCompany.pessoa_contato,
    instagram: dbCompany.instagram,
    creationDate: dbCompany.data_criacao,
    isActive: dbCompany.esta_ativa,
});

// FIX: Export mapResearcherFromDb to be used in other files.
export const mapResearcherFromDb = (dbResearcher: any): Researcher => ({
    id: dbResearcher.id,
    name: dbResearcher.nome,
    email: dbResearcher.email,
    phone: dbResearcher.telefone,
    gender: dbResearcher.genero as Gender,
    dob: dbResearcher.data_nascimento,
    photoUrl: dbResearcher.url_foto,
    isActive: dbResearcher.esta_ativo,
    color: dbResearcher.cor,
});

const mapVoucherFromDb = (dbVoucher: any): Voucher => ({
    id: dbVoucher.id,
    companyId: dbVoucher.id_empresa,
    title: dbVoucher.titulo,
    description: dbVoucher.descricao,
    qrCodeValue: dbVoucher.valor_qrcode,
    isActive: dbVoucher.esta_ativo,
    logoUrl: dbVoucher.url_logo,
    totalQuantity: dbVoucher.quantidade_total,
    usedCount: dbVoucher.quantidade_usada,
});

const mapQuestionOptionFromDb = (dbOption: any): QuestionOption => ({
    value: dbOption.valor,
    jumpTo: dbOption.pular_para_pergunta || (dbOption.pular_para_final ? 'END_SURVEY' : null),
});

const mapQuestionFromDb = (dbQuestion: any, options: any[]): Question => ({
    id: dbQuestion.id,
    text: dbQuestion.texto,
    type: dbQuestion.tipo as QuestionType,
    allowMultipleAnswers: dbQuestion.permitir_multiplas_respostas,
    options: options.filter(o => o.id_pergunta === dbQuestion.id).sort((a,b) => a.ordem - b.ordem).map(mapQuestionOptionFromDb),
});

const mapCampaignFromDb = (dbCampaign: any, allQuestionsData: any[], allOptionsData: any[], companies: any[], researchers: any[], allActivationPoints: any[]): Campaign => {
    const campaignQuestions = allQuestionsData
        .filter(q => q.id_campanha === dbCampaign.id)
        .sort((a,b) => a.ordem - b.ordem)
        .map(q => mapQuestionFromDb(q, allOptionsData));
    
    const responseCount = Array.isArray(dbCampaign.respostas_pesquisas) ? dbCampaign.respostas_pesquisas[0]?.count ?? 0 : 0;
    
    const campaignActivationPoints: ActivationPoint[] = allActivationPoints
        .filter(p => p.id_campanha === dbCampaign.id)
        .map(p => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            radius: p.raio_metros
        }));

    return {
        id: dbCampaign.id,
        name: dbCampaign.nome,
        description: dbCampaign.descricao,
        theme: dbCampaign.tema,
        isActive: dbCampaign.esta_ativa,
        startDate: dbCampaign.data_inicio,
        endDate: dbCampaign.data_fim,
        startTime: dbCampaign.hora_inicio,
        endTime: dbCampaign.hora_fim,
        lgpdText: dbCampaign.texto_lgpd,
        collectUserInfo: dbCampaign.coletar_info_usuario,
        responseGoal: dbCampaign.meta_respostas,
        questions: campaignQuestions,
        companyIds: companies.filter(c => c.id_campanha === dbCampaign.id).map(c => c.id_empresa),
        researcherIds: researchers.filter(r => r.id_campanha === dbCampaign.id).map(r => r.id_pesquisador),
        finalRedirectUrl: dbCampaign.url_redirecionamento_final,
        responseCount: responseCount,
        activationPoints: campaignActivationPoints,
    } as any;
};

const mapCampaignForManagement = (dbCampaign: any, companies: any[], researchers: any[], allActivationPoints: any[]): Campaign => {
    const responseCount = Array.isArray(dbCampaign.respostas_pesquisas) ? dbCampaign.respostas_pesquisas[0]?.count ?? 0 : 0;
    
    const campaignActivationPoints: ActivationPoint[] = allActivationPoints
        .filter(p => p.id_campanha === dbCampaign.id)
        .map(p => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            radius: p.raio_metros
        }));

    return {
        id: dbCampaign.id,
        name: dbCampaign.nome,
        description: dbCampaign.descricao,
        theme: dbCampaign.tema,
        isActive: dbCampaign.esta_ativa,
        startDate: dbCampaign.data_inicio,
        endDate: dbCampaign.data_fim,
        startTime: dbCampaign.hora_inicio,
        endTime: dbCampaign.hora_fim,
        lgpdText: dbCampaign.texto_lgpd,
        collectUserInfo: dbCampaign.coletar_info_usuario,
        responseGoal: dbCampaign.meta_respostas,
        questions: [], // Does not include questions for performance
        companyIds: companies.filter(c => c.id_campanha === dbCampaign.id).map(c => c.id_empresa),
        researcherIds: researchers.filter(r => r.id_campanha === dbCampaign.id).map(r => r.id_pesquisador),
        finalRedirectUrl: dbCampaign.url_redirecionamento_final,
        responseCount: responseCount,
        activationPoints: campaignActivationPoints,
    } as any;
};

const mapResponseFromDb = (dbResponse: any, answers: any[]): SurveyResponse => ({
    id: dbResponse.id,
    campaignId: dbResponse.id_campanha,
    researcherId: dbResponse.id_pesquisador,
    userName: dbResponse.nome_usuario,
    userPhone: dbResponse.telefone_usuario,
    userAge: dbResponse.idade_usuario,
    timestamp: new Date(dbResponse.data_envio),
    answers: answers.filter(a => a.id_resposta_pesquisa === dbResponse.id).map(a => ({
        questionId: a.id_pergunta,
        answer: a.valor,
    })),
});

export const mapLocationPointFromDb = (dbPoint: any): LocationPoint => ({
    id: dbPoint.id,
    researcherId: dbPoint.id_pesquisador,
    latitude: dbPoint.latitude,
    longitude: dbPoint.longitude,
    timestamp: dbPoint.timestamp,
});

async function fetchData(table: string) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(error.message);
    return data;
}

// API Functions
export const getAdmins = async (): Promise<Admin[]> => (await fetchData('administradores')).map(mapAdminFromDb);
export const getCompanies = async (): Promise<Company[]> => (await fetchData('empresas')).map(mapCompanyFromDb);
export const getResearchers = async (): Promise<Researcher[]> => (await fetchData('pesquisadores')).map(mapResearcherFromDb);
export const getVouchers = async (): Promise<Voucher[]> => (await fetchData('vouchers')).map(mapVoucherFromDb);

export const getResponses = async (page = 0, pageSize = 10): Promise<{ data: SurveyResponse[], count: number }> => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: responsesData, error: responsesError, count } = await supabase
        .from('respostas_pesquisas')
        .select('*', { count: 'exact' })
        .range(from, to);

    if(responsesError) throw responsesError;

    const { data: answersData, error: answersError } = await supabase.from('respostas').select('*');
    if (answersError) throw answersError;

    const mappedData = responsesData.map(r => mapResponseFromDb(r, answersData));
    return { data: mappedData, count: count ?? 0 };
};

// Returns ALL campaigns, but is more efficient now.
export const getFullCampaigns = async (): Promise<Campaign[]> => {
    const [campaignsData, questionsData, optionsData, companiesData, researchersData, activationPointsData] = await Promise.all([
        fetchData('campanhas'),
        fetchData('perguntas'),
        fetchData('opcoes_perguntas'),
        fetchData('campanhas_empresas'),
        fetchData('campanhas_pesquisadores'),
        fetchData('pontos_ativacao'),
    ]);
    return campaignsData.map(c => mapCampaignFromDb(c, questionsData, optionsData, companiesData, researchersData, activationPointsData));
};

export const getCampaignsForManagement = async (): Promise<Campaign[]> => {
    const [{ data: campaignsData, error }, companiesData, researchersData, activationPointsData] = await Promise.all([
        supabase.from('campanhas').select('*, respostas_pesquisas(count)'),
        fetchData('campanhas_empresas'),
        fetchData('campanhas_pesquisadores'),
        fetchData('pontos_ativacao'),
    ]);
    if (error) throw error;
    if (!campaignsData) return [];
    return campaignsData.map(c => mapCampaignForManagement(c, companiesData, researchersData, activationPointsData));
};

export const getPaginatedCampaigns = async (page: number, pageSize: number, filters: { status: string; companyId: string; searchQuery: string; researcherId?: string; }): Promise<{data: Campaign[], count: number}> => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    let query = supabase.from('campanhas').select('*, respostas_pesquisas(count)', { count: 'exact' });

    if (filters.status !== 'all') {
        query = query.eq('esta_ativa', filters.status === 'active');
    }

    if(filters.searchQuery) {
        query = query.ilike('nome', `%${filters.searchQuery}%`);
    }
    
    if (filters.researcherId) {
        const { data: campaignIdsData } = await supabase.from('campanhas_pesquisadores').select('id_campanha').eq('id_pesquisador', filters.researcherId);
        const campaignIds = campaignIdsData?.map(c => c.id_campanha) || [];
        query = query.in('id', campaignIds);
    }
    
     if (filters.companyId && filters.companyId !== 'all') {
        const { data: campaignIdsData } = await supabase.from('campanhas_empresas').select('id_campanha').eq('id_empresa', filters.companyId);
        const campaignIds = campaignIdsData?.map(c => c.id_campanha) || [];
        query = query.in('id', campaignIds);
    }

    const { data: campaignsData, error, count } = await query.range(from, to).order('nome');

    if (error) throw error;
    
     const [questionsData, optionsData, companiesData, researchersData, activationPointsData] = await Promise.all([
        fetchData('perguntas'),
        fetchData('opcoes_perguntas'),
        fetchData('campanhas_empresas'),
        fetchData('campanhas_pesquisadores'),
        fetchData('pontos_ativacao'),
    ]);

    const mappedData = campaignsData.map(c => mapCampaignFromDb(c, questionsData, optionsData, companiesData, researchersData, activationPointsData));
    return { data: mappedData, count: count ?? 0 };
};

export const getCampaignById = async (id: string): Promise<Campaign | null> => {
    const { data: campaignData, error: campaignError } = await supabase.from('campanhas').select('*').eq('id', id).single();
    if (campaignError || !campaignData) return null;

    const { data: questionsData, error: questionsError } = await supabase.from('perguntas').select('*').eq('id_campanha', id).order('ordem');
    if(questionsError) throw questionsError;

    const questionIds = questionsData.map(q => q.id);
    const { data: optionsData, error: optionsError } = await supabase.from('opcoes_perguntas').select('*').in('id_pergunta', questionIds);
    if(optionsError) throw optionsError;

    const { data: companiesData, error: companiesError } = await supabase.from('campanhas_empresas').select('*').eq('id_campanha', id);
    if(companiesError) throw companiesError;
    
    const { data: researchersData, error: researchersError } = await supabase.from('campanhas_pesquisadores').select('*').eq('id_campanha', id);
    if(researchersError) throw researchersError;
    
    const { data: activationPointsData, error: activationPointsError } = await supabase.from('pontos_ativacao').select('*').eq('id_campanha', id);
    if(activationPointsError) throw activationPointsError;


    return mapCampaignFromDb(campaignData, questionsData, optionsData, companiesData, researchersData, activationPointsData);
}

export const getCompanyById = async (id: string): Promise<Company | null> => {
    const { data, error } = await supabase.from('empresas').select('*').eq('id', id).single();
    if (error) {
        console.error("Error fetching company by id:", error);
        return null;
    }
    return mapCompanyFromDb(data);
};

export const addSurveyResponse = async (response: Omit<SurveyResponse, 'id' | 'timestamp'>) => {
    const { data, error } = await supabase
        .from('respostas_pesquisas')
        .insert({
            id_campanha: response.campaignId,
            id_pesquisador: response.researcherId,
            nome_usuario: response.userName,
            telefone_usuario: response.userPhone,
            idade_usuario: response.userAge,
        })
        .select()
        .single();
    
    if (error) throw error;
    
    const answersToInsert = response.answers.map(answer => ({
        id_resposta_pesquisa: data.id,
        id_pergunta: answer.questionId,
        valor: answer.answer
    }));

    const { error: answersError } = await supabase.from('respostas').insert(answersToInsert);
    if (answersError) throw answersError;

    try {
        // Find company IDs for the campaign
        const { data: campaignCompaniesData, error: campaignCompaniesError } = await supabase
            .from('campanhas_empresas')
            .select('id_empresa')
            .eq('id_campanha', response.campaignId);

        if (campaignCompaniesError) throw campaignCompaniesError;
        
        if (!campaignCompaniesData || campaignCompaniesData.length === 0) {
            return; // No companies, so no vouchers to redeem
        }

        const companyIds = campaignCompaniesData.map(c => c.id_empresa);

        // Find active vouchers for those companies
        const { data: activeVouchers, error: vouchersError } = await supabase
            .from('vouchers')
            .select('id, quantidade_usada, quantidade_total')
            .in('id_empresa', companyIds)
            .eq('esta_ativo', true);

        if (vouchersError) throw vouchersError;

        if (activeVouchers) {
            // Filter for vouchers that have not reached their limit
            const availableVouchers = activeVouchers.filter(v => v.quantidade_usada < v.quantidade_total);

            if (availableVouchers.length > 0) {
                // Increment the used count for each available voucher
                const voucherUpdates = availableVouchers.map(v => 
                    supabase
                        .from('vouchers')
                        .update({ quantidade_usada: v.quantidade_usada + 1 })
                        .eq('id', v.id)
                );
                
                const results = await Promise.allSettled(voucherUpdates);
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error('Failed to update a voucher count:', result.reason);
                    }
                });
            }
        }
    } catch (e) {
        // Log the error, but don't let it block the user flow since the main response was saved.
        console.error('Error incrementing voucher count:', e);
    }
};

// Helper to extract path from a full Supabase storage URL
const getPathFromUrl = (url: string) => {
    try {
        const urlObject = new URL(url);
        // Path format: /storage/v1/object/public/bucket-name/file/path.ext
        const path = urlObject.pathname.split(`/imagens/`)[1];
        return path;
    } catch (e) {
        console.error("Invalid URL for path extraction", url);
        return null;
    }
}

// Deletes an image from the 'imagens' bucket given its public URL
export const deleteImage = async (url: string) => {
    if (!url || !url.includes('supabase.co')) return; // Don't try to delete placeholder/local/blob URLs
    const path = getPathFromUrl(url);
    if (!path) return;
    const { error } = await supabase.storage.from('imagens').remove([path]);
    if (error) {
        // Don't alert, just log. It could be a stale URL from a failed previous upload.
        console.error("Error deleting image:", error.message);
    }
}

// Uploads a file to the 'imagens' bucket and returns the public URL
export const uploadImage = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('imagens')
        .upload(filePath, file);
    
    if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage.from('imagens').getPublicUrl(filePath);
    return data.publicUrl;
}


// ... remaining functions (location, etc.) are fine ...
export const addLocationUpdate = async (researcherId: string, latitude: number, longitude: number): Promise<void> => {
    const { error } = await supabase.from('pesquisador_localizacao').insert({
        id_pesquisador: researcherId,
        latitude: latitude,
        longitude: longitude,
    });
    if (error) {
        console.error("Failed to add location update:", error);
    }
}

export const getResearcherRoute = async (researcherId: string, date: string): Promise<LocationPoint[]> => {
    // date is 'YYYY-MM-DD'
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    const { data, error } = await supabase
        .from('pesquisador_localizacao')
        .select('*')
        .eq('id_pesquisador', researcherId)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: true });

    if (error) {
        console.error("Failed to get researcher route:", error);
        return [];
    }
    return data.map(mapLocationPointFromDb);
}

export const getResearcherLastLocation = async (researcherId: string): Promise<LocationPoint | null> => {
    const { data, error } = await supabase
        .from('pesquisador_localizacao')
        .select('*')
        .eq('id_pesquisador', researcherId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        // console.warn("Não foi possível buscar a última localização:", researcherId, error?.message);
        return null;
    }
    return mapLocationPointFromDb(data);
}

export const getAllResearchersLastLocations = async (researcherIds: string[]): Promise<LocationPoint[]> => {
    if (researcherIds.length === 0) {
        return [];
    }
    const locationPromises = researcherIds.map(id => getResearcherLastLocation(id));
    const results = await Promise.all(locationPromises);
    return results.filter((point): point is LocationPoint => point !== null);
}

// DASHBOARD AGGREGATES
export const getResponseCountsByResearcher = async (): Promise<Map<string, number>> => {
    const { data, error } = await supabase
        .from('respostas_pesquisas')
        .select('id_pesquisador');

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const response of data) {
        if (response.id_pesquisador) {
            counts.set(response.id_pesquisador, (counts.get(response.id_pesquisador) || 0) + 1);
        }
    }
    return counts;
}

export const getAdminDashboardData = async () => {
    // 1. Stat Cards data
    const [
        { count: activeCompaniesCount },
        { count: totalCampaignsCount },
        { count: totalVouchersCount },
        { count: totalResponsesCount }
    ] = await Promise.all([
        supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('esta_ativa', true),
        supabase.from('campanhas').select('*', { count: 'exact', head: true }),
        supabase.from('vouchers').select('*', { count: 'exact', head: true }),
        supabase.from('respostas_pesquisas').select('*', { count: 'exact', head: true })
    ]);

    // 2. Data for charts and lists
    const [
        { data: campaignsWithResponses, error: campaignsError },
        { data: responseDates, error: datesError },
        { data: campaignThemes, error: themesError },
        { data: recentResponsesData, error: recentResponsesError }
    ] = await Promise.all([
        supabase.from('campanhas').select('id, nome, meta_respostas, respostas_pesquisas(count)'),
        supabase.from('respostas_pesquisas').select('data_envio'),
        supabase.from('campanhas').select('tema'),
        supabase.from('respostas_pesquisas').select('id, nome_usuario, data_envio, id_campanha').order('data_envio', { ascending: false }).limit(10)
    ]);

    if (campaignsError || datesError || themesError || recentResponsesError) {
        console.error({ campaignsError, datesError, themesError, recentResponsesError });
        throw new Error('Failed to fetch dashboard chart data.');
    }

    // Process campaign performance data
    const campaignPerformanceData = campaignsWithResponses.map(c => ({
        name: c.nome,
        respostas: c.respostas_pesquisas[0]?.count ?? 0,
        meta: c.meta_respostas,
    })).sort((a, b) => b.respostas - a.respostas);
    
    // Process response volume data
    const dailyCounts = responseDates.reduce((acc, response) => {
        const date = new Date(response.data_envio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const responsesOverTimeData = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => {
            const [dayA, monthA] = a.date.split('/');
            const [dayB, monthB] = b.date.split('/');
            return new Date(`2000-${monthA}-${dayA}`).getTime() - new Date(`2000-${monthB}-${dayB}`).getTime();
        });

    // Process campaign theme data
    const themeCounts = campaignThemes.reduce((acc, campaign) => {
        acc[campaign.tema] = (acc[campaign.tema] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const campaignThemeData = Object.entries(themeCounts).map(([name, value]) => ({ name, value }));

    // Process recent activity data
    const campaignNamesMap = new Map<string, string>();
    campaignsWithResponses.forEach(c => campaignNamesMap.set(c.id, c.nome));
    const recentActivity = recentResponsesData.map(r => ({
        id: r.id,
        userName: r.nome_usuario,
        campaignName: campaignNamesMap.get(r.id_campanha) || 'N/A',
        timestamp: new Date(r.data_envio),
    }));

    return {
        stats: {
            activeCompanies: activeCompaniesCount ?? 0,
            totalCampaigns: totalCampaignsCount ?? 0,
            totalVouchers: totalVouchersCount ?? 0,
            totalResponses: totalResponsesCount ?? 0,
        },
        campaignPerformanceData,
        responsesOverTimeData,
        campaignThemeData,
        recentActivity,
    };
};


export const getCompanyDashboardStats = async (companyId: string) => {
    const { data: campaignIds, error: campaignIdsError } = await supabase
        .from('campanhas_empresas')
        .select('id_campanha')
        .eq('id_empresa', companyId);

    if (campaignIdsError) throw campaignIdsError;
    const ids = campaignIds.map(c => c.id_campanha);

    const { count: responsesCount, error: responsesError } = await supabase
        .from('respostas_pesquisas')
        .select('*', { count: 'exact', head: true })
        .in('id_campanha', ids);
    
    if (responsesError) throw responsesError;

    // This is a simplification. A real average would require fetching scores.
    // For now, we'll keep the logic in the component but this shows how to get counts.
    return {
        totalResponses: responsesCount ?? 0,
        participatingCampaigns: ids.length,
    };
};