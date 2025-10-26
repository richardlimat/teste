// pages/admin/AdminMapPage.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Researcher, LocationPoint } from '../../types';
import { getResearchers, getAllResearchersLastLocations, mapLocationPointFromDb } from '../../services/api';
import { supabase } from '../../services/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

declare const L: any;

const AdminMapPage: React.FC = () => {
    const [researchers, setResearchers] = useState<Researcher[]>([]);
    const [locations, setLocations] = useState<Map<string, LocationPoint>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredResearcherId, setHoveredResearcherId] = useState<string | null>(null);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
    const realtimeChannelRef = useRef<any>(null);

    const activeResearchers = useMemo(() => researchers.filter(r => r.isActive), [researchers]);

    const updateMarker = (researcher: Researcher, point: LocationPoint) => {
        if (!mapRef.current) return;

        const latLng: [number, number] = [point.latitude, point.longitude];
        const existingMarker = markersRef.current.get(researcher.id);
        
        const borderColor = researcher.color || '#3B82F6';
        const isHovered = hoveredResearcherId === researcher.id;

        const iconHtml = `
            <div class="researcher-avatar-marker-div" style="transform: scale(${isHovered ? 1.2 : 1}); z-index: ${isHovered ? 1000 : 500};">
                <div class="researcher-avatar-marker" style="border-color: ${borderColor};">
                    <img src="${researcher.photoUrl}" alt="${researcher.name}" />
                </div>
            </div>
        `;
        
        const icon = L.divIcon({
            html: iconHtml,
            className: '', // Clear default class
            iconSize: [44, 44],
            iconAnchor: [22, 44],
            popupAnchor: [0, -46]
        });

        const popupContent = `
            <div class="font-sans">
                <b class="text-base">${researcher.name}</b><br>
                Última atualização: ${new Date(point.timestamp).toLocaleString('pt-BR')}
            </div>
        `;

        if (existingMarker) {
            existingMarker.setLatLng(latLng).setIcon(icon).setPopupContent(popupContent);
        } else {
            const newMarker = L.marker(latLng, { icon }).bindPopup(popupContent).addTo(mapRef.current);
            markersRef.current.set(researcher.id, newMarker);
        }
    };

    const fitBounds = () => {
        if (!mapRef.current || markersRef.current.size === 0) return;
        const group = L.featureGroup(Array.from(markersRef.current.values()));
        mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    };

    // Initialize map
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([-15.78, -47.92], 4);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapRef.current);
            L.control.zoom({ position: 'topright' }).addTo(mapRef.current);
        }

        // Cleanup on component unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);
    
    // Fetch initial data and set up realtime
    useEffect(() => {
        let isMounted = true;
        
        const setup = async () => {
            setIsLoading(true);
            const allResearchers = await getResearchers();
            if (!isMounted) return;
            
            setResearchers(allResearchers);
            const activeResearcherIds = allResearchers.filter(r => r.isActive).map(r => r.id);
            const initialPoints = await getAllResearchersLastLocations(activeResearcherIds);
            
            if (!isMounted) return;

            const initialLocations = new Map<string, LocationPoint>();
            initialPoints.forEach(point => initialLocations.set(point.researcherId, point));
            setLocations(initialLocations);
            setIsLoading(false);

            // Realtime subscription
            realtimeChannelRef.current = supabase
                .channel('all-researchers-location-page')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'pesquisador_localizacao',
                }, (payload) => {
                    const newPoint = mapLocationPointFromDb(payload.new);
                    if (isMounted && activeResearcherIds.includes(newPoint.researcherId)) {
                        setLocations(prev => new Map(prev).set(newPoint.researcherId, newPoint));
                    }
                })
                .subscribe();
        };

        setup();

        return () => {
            isMounted = false;
            if (realtimeChannelRef.current) {
                supabase.removeChannel(realtimeChannelRef.current);
            }
        };

    }, []);

    // Update markers on map when locations or hover state change
    useEffect(() => {
        if (!mapRef.current) return;
        
        activeResearchers.forEach(researcher => {
            const point = locations.get(researcher.id);
            if (point) {
                updateMarker(researcher, point);
            }
        });

        // Fit bounds only on initial load or when researcher list changes
    }, [locations, activeResearchers, hoveredResearcherId]);

    useEffect(() => {
        fitBounds();
    }, [locations]);


    const handleResearcherClick = (researcherId: string) => {
        const marker = markersRef.current.get(researcherId);
        if (marker && mapRef.current) {
            mapRef.current.flyTo(marker.getLatLng(), 16, { duration: 1 });
            setTimeout(() => marker.openPopup(), 1100);
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex-shrink-0 mb-4">
                 <h1 className="text-3xl font-bold">Mapa em Tempo Real</h1>
                 <p className="text-gray-500 dark:text-gray-400">Acompanhe a localização dos pesquisadores ativos.</p>
            </div>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                <div className="lg:col-span-3 relative w-full h-full bg-gray-200 dark:bg-dark-background rounded-lg shadow-md overflow-hidden">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
                           <LoadingSpinner text="Carregando mapa e localizações" />
                        </div>
                    )}
                    <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }}/>
                </div>

                <div className="lg:col-span-1 bg-light-background dark:bg-dark-card rounded-lg shadow-md p-4 flex flex-col h-full">
                    <h3 className="font-bold text-lg border-b border-light-border dark:border-dark-border pb-2 mb-2 flex-shrink-0">
                        Pesquisadores Ativos ({locations.size}/{activeResearchers.length})
                    </h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {activeResearchers.length > 0 ? activeResearchers.map(researcher => {
                            const location = locations.get(researcher.id);
                            return (
                                 <div 
                                    key={researcher.id} 
                                    className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-background/50 transition-colors"
                                    onClick={() => handleResearcherClick(researcher.id)}
                                    onMouseEnter={() => setHoveredResearcherId(researcher.id)}
                                    onMouseLeave={() => setHoveredResearcherId(null)}
                                >
                                    <img src={researcher.photoUrl} alt={researcher.name} className="h-10 w-10 rounded-full object-cover"/>
                                    <div className="flex-grow min-w-0">
                                        <p className="font-semibold truncate">{researcher.name}</p>
                                        <p className={`text-xs ${location ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                            {location ? `Online - ${new Date(location.timestamp).toLocaleTimeString()}` : 'Offline'}
                                        </p>
                                    </div>
                                    <div 
                                        className="h-3 w-3 rounded-full flex-shrink-0 border-2" 
                                        style={{ 
                                            backgroundColor: location ? researcher.color || '#3B82F6' : 'transparent',
                                            borderColor: location ? researcher.color || '#3B82F6' : '#9CA3AF'
                                        }}
                                    ></div>
                                </div>
                            )
                        }) : <p className="text-sm text-gray-500 text-center py-4">Nenhum pesquisador ativo.</p>}
                    </div>
                     <div className="flex-shrink-0 pt-2 mt-2 border-t border-light-border dark:border-dark-border">
                        <button onClick={fitBounds} className="w-full text-center text-sm font-semibold text-light-primary hover:underline">
                            Mostrar todos no mapa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminMapPage;