'use client';
import { useState, useEffect } from 'react';
import { COMPANY_DEFAULTS, CompanyInfo } from '@/config/company';

export function useCompanyInfo(): CompanyInfo & { isLoading: boolean } {
  const [data, setData] = useState<CompanyInfo>(COMPANY_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/company_info')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.value) {
          setData({ ...COMPANY_DEFAULTS, ...json.value });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { ...data, isLoading };
}
