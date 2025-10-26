// components/TrackingMapModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { Researcher, LocationPoint } from '../types';
import { getResearcherRoute, getResearcherLastLocation, mapLocationPointFromDb } from '../services/api';
import { supabase } from '../services/supabase';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

declare const L: any; // Using Leaflet from CDN

interface TrackingMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    researcher: Researcher | null;
}

const TrackingMapModal: React.FC<TrackingMapModalProps> = ({ isOpen, onClose, researcher }) => {
    const [mode, setMode] = useState<'history' | 'live'>('history');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [liveStatus, setLiveStatus] = useState('Conectando...');

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const routeLayerRef = useRef<any>(null); // For historical route
    const liveLayerRef = useRef<any>(null); // For live marker and polyline
    const realtimeChannelRef = useRef<any>(null);

    const clearHistoryLayers = () => {
        if (mapRef.current && routeLayerRef.current) {
            mapRef.current.removeLayer(routeLayerRef.current);
        }
        routeLayerRef.current = null;
        setRoutePoints([]);
    };

    const clearLiveLayers = () => {
        if (mapRef.current && liveLayerRef.current) {
            mapRef.current.removeLayer(liveLayerRef.current);
        }
        liveLayerRef.current = null;
    };

    const fetchRoute = async () => {
        if (!researcher) return;
        setIsLoading(true);
        try {
            const points = await getResearcherRoute(researcher.id, date);
            setRoutePoints(points);
        } catch (e) {
            console.error(e);
            alert('Falha ao buscar rota.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && researcher && mode === 'history') {
            fetchRoute();
        }
    }, [isOpen, researcher, date, mode]);

    useEffect(() => {
        if (isOpen && mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([-15.78, -47.92], 4); // Brazil center
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapRef.current);
        }

        if (isOpen && mapRef.current) {
            setTimeout(() => mapRef.current.invalidateSize(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (mapRef.current && mode === 'history') {
            clearHistoryLayers();
            if (routePoints.length > 0) {
                const latLngs = routePoints.map(p => [p.latitude, p.longitude]);
                const polyline = L.polyline(latLngs, { color: 'blue' });

                const startMarker = L.marker(latLngs[0]).bindPopup(`Início: ${new Date(routePoints[0].timestamp).toLocaleTimeString()}`);
                const endMarker = L.marker(latLngs[latLngs.length - 1]).bindPopup(`Fim: ${new Date(routePoints[routePoints.length - 1].timestamp).toLocaleTimeString()}`);
                
                const markers = routePoints.map(p => 
                    L.circleMarker([p.latitude, p.longitude], { radius: 3, color: 'red' }).bindTooltip(new Date(p.timestamp).toLocaleTimeString())
                );

                routeLayerRef.current = L.layerGroup([polyline, startMarker, endMarker, ...markers]).addTo(mapRef.current);
                mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            }
        }
    }, [routePoints, mode]);

    useEffect(() => {
        if (mode !== 'live' || !isOpen || !researcher) return;

        let isMounted = true;
        
        const setupSubscription = async () => {
            clearHistoryLayers();
            setIsLoading(true);
            setLiveStatus('Buscando última localização...');

            const lastPoint = await getResearcherLastLocation(researcher.id);
            if (!isMounted) return;

            const liveLayers = L.layerGroup().addTo(mapRef.current);
            liveLayerRef.current = liveLayers;
            const livePolyline = L.polyline([], { color: 'red' }).addTo(liveLayers);
            let liveMarker: any = null;
            
            const pulsingIcon = L.divIcon({
                className: 'css-icon',
                html: '<div class="gps_ring"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            });

            if (lastPoint) {
                const latLng = [lastPoint.latitude, lastPoint.longitude];
                liveMarker = L.marker(latLng, { icon: pulsingIcon }).addTo(liveLayers);
                livePolyline.addLatLng(latLng);
                mapRef.current.setView(latLng, 16);
            } else {
                mapRef.current.setView([-15.78, -47.92], 4);
            }
            setIsLoading(false);

            realtimeChannelRef.current = supabase
                .channel(`realtime-location:${researcher.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'pesquisador_localizacao',
                    filter: `id_pesquisador=eq.${researcher.id}`,
                }, (payload) => {
                    if (!isMounted) return;
                    setLiveStatus(`Última atualização: ${new Date().toLocaleTimeString()}`);
                    const newPoint = mapLocationPointFromDb(payload.new);
                    const newLatLng = [newPoint.latitude, newPoint.longitude];
                    
                    if (liveMarker) {
                        liveMarker.setLatLng(newLatLng);
                    } else {
                        liveMarker = L.marker(newLatLng, { icon: pulsingIcon }).addTo(liveLayers);
                    }
                    livePolyline.addLatLng(newLatLng);
                    mapRef.current.panTo(newLatLng);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        setLiveStatus('Conectado. Aguardando atualizações...');
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        setLiveStatus('Erro de conexão. Tentando reconectar...');
                    }
                });
        };

        setupSubscription();

        return () => {
            isMounted = false;
            if (realtimeChannelRef.current) {
                supabase.removeChannel(realtimeChannelRef.current);
            }
            clearLiveLayers();
        };
    }, [mode, isOpen, researcher]);

    const handleModeChange = (newMode: typeof mode) => {
        if (newMode === mode) return;
        setMode(newMode);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Rastreamento de ${researcher?.name || ''}`}>
            <div className="space-y-4">
                <div className="flex items-center gap-2 p-1 bg-gray-200 dark:bg-dark-background rounded-lg mb-2">
                    <button onClick={() => handleModeChange('history')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'history' ? 'bg-white dark:bg-dark-card shadow text-light-primary' : 'text-gray-600 dark:text-gray-300'}`}>
                        Histórico
                    </button>
                    <button onClick={() => handleModeChange('live')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'live' ? 'bg-white dark:bg-dark-card shadow text-light-primary' : 'text-gray-600 dark:text-gray-300'}`}>
                        Ao Vivo
                    </button>
                </div>

                {mode === 'history' ? (
                    <div className="flex items-center gap-4">
                        <label htmlFor="route-date" className="font-medium">Selecione a Data:</label>
                        <input id="route-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-style"/>
                    </div>
                ) : (
                    <div className="text-center text-sm p-2 bg-gray-100 dark:bg-dark-background rounded-md text-gray-600 dark:text-gray-300">
                        {liveStatus}
                    </div>
                )}

                <div className="relative w-full h-[50vh] bg-gray-200 dark:bg-dark-background rounded-md overflow-hidden">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
                           <LoadingSpinner text="Buscando rota" />
                        </div>
                    )}
                    <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }}/>
                    {!isLoading && mode === 'history' && routePoints.length === 0 && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <p className="p-2 bg-white/80 dark:bg-black/80 rounded-md">Nenhum dado de localização encontrado para esta data.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default TrackingMapModal;