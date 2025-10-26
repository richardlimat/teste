// components/PaginationControls.tsx
import React from 'react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  pageSize: number;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize,
}) => {
  const handlePrevious = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const startItem = totalCount > 0 ? currentPage * pageSize + 1 : 0;
  const endItem = Math.min((currentPage + 1) * pageSize, totalCount);

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-300">
      <div>
        <p>
          Mostrando <span className="font-semibold">{startItem}</span>-
          <span className="font-semibold">{endItem}</span> de{' '}
          <span className="font-semibold">{totalCount}</span> resultados
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md hover:bg-gray-100 dark:hover:bg-dark-background disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Anterior
        </button>
        <span className="font-semibold">
          Página {currentPage + 1} de {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md hover:bg-gray-100 dark:hover:bg-dark-background disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Próxima página"
        >
          Próximo
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
