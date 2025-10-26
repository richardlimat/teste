// components/AssignCompaniesModal.tsx
import React, { useState, useEffect } from 'react';
import type { Campaign, Company } from '../types';
import { getCompanies } from '../services/api';
import { supabase } from '../services/supabase';
import Modal from './Modal';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { ToggleSwitch } from './ToggleSwitch';

interface AssignCompaniesModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: Campaign;
    onSave: (campaign: Campaign, assignedCompanyIds: string[]) => void;
}

const AssignCompaniesModal: React.FC<AssignCompaniesModalProps> = ({ isOpen, onClose, campaign, onSave }) => {
    const [assignedIds, setAssignedIds] = useState<string[]>([]);
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchCompanies = () => {
        setIsLoading(true);
        getCompanies().then(companies => {
            setAllCompanies(companies);
            setAssignedIds(campaign.companyIds || []);
            setIsLoading(false);
        });
    };

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [isOpen, campaign]);
    
    const handleToggleCompany = (companyId: string) => {
        setAssignedIds(prev =>
            prev.includes(companyId)
                ? prev.filter(id => id !== companyId)
                : [...prev, companyId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(campaign, assignedIds);
    };

    const handleToggleCompanyActive = async (company: Company) => {
        const { error } = await supabase.from('empresas').update({ esta_ativa: !company.isActive }).eq('id', company.id);
        if (error) {
            alert('Falha ao atualizar status da empresa.');
        } else {
           fetchCompanies(); // Refetch to get updated status
        }
    }

    const filteredCompanies = allCompanies.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Vincular Empresas a ${campaign.name}`}>
             <form onSubmit={handleSubmit}>
                <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar empresa..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full input-style pl-10"
                    />
                </div>
                {isLoading ? <p>Carregando empresas...</p> : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 border border-light-border dark:border-dark-border rounded-md p-2">
                        {filteredCompanies.map(company => (
                            <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-background rounded-md">
                                <label className="flex items-center cursor-pointer flex-grow">
                                    <input
                                        type="checkbox"
                                        checked={assignedIds.includes(company.id)}
                                        onChange={() => handleToggleCompany(company.id)}
                                        className="h-5 w-5 text-light-primary focus:ring-light-primary rounded"
                                        disabled={!company.isActive}
                                    />
                                    <span className={`ml-3 flex-grow ${!company.isActive ? 'text-gray-400 line-through' : ''}`}>{company.name}</span>
                                </label>
                                 <div className="flex items-center gap-2">
                                    {!company.isActive && <span className="text-xs font-semibold text-error">INATIVA</span>}
                                    <ToggleSwitch
                                        checked={company.isActive}
                                        onChange={() => handleToggleCompanyActive(company)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-light-border dark:border-dark-border">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:opacity-90">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-gradient-to-r from-gradient-cyan to-gradient-blue text-white font-bold rounded-lg hover:opacity-90">Salvar Vínculos</button>
                </div>
             </form>
        </Modal>
    );
};

export default AssignCompaniesModal;
