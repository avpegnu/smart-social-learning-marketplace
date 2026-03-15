'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Skeleton,
} from '@shared/ui';
import { ChevronLeft, ChevronRight, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKey?: string;
  pageSize?: number;
  filterSlot?: React.ReactNode;
  className?: string;
  // Server-side mode (when provided, disables client-side filtering/pagination)
  isLoading?: boolean;
  serverPage?: number;
  serverTotalPages?: number;
  serverTotal?: number;
  onServerPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function DataTable({
  columns,
  data,
  searchable = false,
  searchPlaceholder,
  searchKey,
  pageSize = 10,
  filterSlot,
  className,
  isLoading,
  serverPage,
  serverTotalPages,
  serverTotal,
  onServerPageChange,
  searchValue,
  onSearchChange,
}: DataTableProps) {
  const t = useTranslations('common');
  const [clientSearch, setClientSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [clientPage, setClientPage] = React.useState(0);

  const isServerMode = serverPage !== undefined && onServerPageChange !== undefined;

  // Client-side filtering (only in client mode)
  const filteredData = React.useMemo(() => {
    if (isServerMode) return data;

    let result = [...data];

    if (searchable && clientSearch && searchKey) {
      result = result.filter((item) => {
        const val = item[searchKey];
        return String(val).toLowerCase().includes(clientSearch.toLowerCase());
      });
    }

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return result;
  }, [data, clientSearch, searchKey, searchable, sortKey, sortDir, isServerMode]);

  // Pagination
  const totalPages = isServerMode
    ? (serverTotalPages ?? 1)
    : Math.ceil(filteredData.length / pageSize);
  const currentPage = isServerMode ? (serverPage ?? 1) - 1 : clientPage;
  const displayData = isServerMode
    ? data
    : filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const totalItems = isServerMode ? (serverTotal ?? data.length) : filteredData.length;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (isServerMode) {
      onServerPageChange!(newPage + 1); // server pages are 1-indexed
    } else {
      setClientPage(newPage);
    }
  };

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setClientSearch(value);
      setClientPage(0);
    }
  };

  const currentSearchValue = onSearchChange ? (searchValue ?? '') : clientSearch;

  return (
    <div className={cn('space-y-4', className)}>
      {(searchable || filterSlot) && (
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={searchPlaceholder || t('search')}
                value={currentSearchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filterSlot}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      className="hover:text-foreground flex cursor-pointer items-center gap-1"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((item, index) => (
                <TableRow key={item.id ?? index}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(item, currentPage * pageSize + index)
                        : String(item[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t('showing')} {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, totalItems)} {t('of')} {totalItems}{' '}
            {t('results')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('previous')}
            </Button>
            <span className="text-muted-foreground text-sm">
              {t('page')} {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
