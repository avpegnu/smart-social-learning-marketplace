'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Skeleton,
} from '@shared/ui';
import { Save } from 'lucide-react';
import { useAdminSettings, useUpdateSetting } from '@shared/hooks';
import { toast } from 'sonner';

interface SettingRecord {
  id: string;
  key: string;
  value: unknown;
}

const SETTING_GROUPS = [
  {
    key: 'general',
    settings: [
      { key: 'platform_name', type: 'text' as const, label: 'platformName' },
      { key: 'platform_description', type: 'text' as const, label: 'platformDescription' },
      { key: 'support_email', type: 'text' as const, label: 'supportEmail' },
    ],
  },
  {
    key: 'commission',
    settings: [
      { key: 'default_commission_rate', type: 'number' as const, label: 'commissionRate' },
      { key: 'minimum_withdrawal', type: 'number' as const, label: 'minimumWithdrawal' },
      { key: 'minimum_payout', type: 'number' as const, label: 'minimumPayout' },
    ],
  },
  {
    key: 'content',
    settings: [
      { key: 'max_upload_size_mb', type: 'number' as const, label: 'maxUploadSize' },
      { key: 'auto_approve_courses', type: 'toggle' as const, label: 'autoApproveCourses' },
      { key: 'allow_free_courses', type: 'toggle' as const, label: 'allowFreeCourses' },
    ],
  },
];

export default function SettingsPage() {
  const t = useTranslations('adminSettings');
  const { data, isLoading } = useAdminSettings();
  const updateMutation = useUpdateSetting();

  const [serverValues, setServerValues] = useState<Record<string, unknown>>({});
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const settings = (data?.data as SettingRecord[]) ?? [];

  // Initialize local values from server
  useEffect(() => {
    if (settings.length > 0) {
      const values: Record<string, unknown> = {};
      for (const s of settings) {
        values[s.key] = s.value;
      }
      setServerValues(values);
      setLocalValues(values);
      setDirty(new Set());
    }
  }, [data]); // Only re-init when server data changes, not on local edits

  const updateLocal = (key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    // Compare with server value — treat undefined/null/"" as equivalent
    const serverVal = serverValues[key];
    const normalize = (v: unknown) => (v == null || v === '' ? '' : String(v));
    setDirty((prev) => {
      const next = new Set(prev);
      if (normalize(value) === normalize(serverVal)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  const saveGroup = async (groupKey: string, keys: string[]) => {
    const dirtyKeys = keys.filter((k) => dirty.has(k));
    if (dirtyKeys.length === 0) return;
    setSavingGroup(groupKey);
    try {
      for (const key of dirtyKeys) {
        await updateMutation.mutateAsync({ key, value: localValues[key] });
      }
      toast.success(t('settingSaved'));
      setDirty((prev) => {
        const next = new Set(prev);
        for (const key of dirtyKeys) next.delete(key);
        return next;
      });
    } catch {
      // Error handled by mutation onError
    } finally {
      setSavingGroup(null);
    }
  };

  const hasInitialized =
    Object.keys(serverValues).length > 0 || (settings.length === 0 && !isLoading);

  if (isLoading || !hasInitialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {SETTING_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="text-base">{t(group.key)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.settings.map((setting) => {
              const value = localValues[setting.key];

              return (
                <div key={setting.key} className="space-y-1">
                  <Label className="text-sm">{t(setting.label)}</Label>
                  {setting.type === 'text' && (
                    <Input
                      value={(value as string) ?? ''}
                      onChange={(e) => updateLocal(setting.key, e.target.value)}
                    />
                  )}
                  {setting.type === 'number' && (
                    <Input
                      type="number"
                      value={(value as number) ?? 0}
                      onChange={(e) => updateLocal(setting.key, Number(e.target.value))}
                    />
                  )}
                  {setting.type === 'toggle' && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => updateLocal(setting.key, e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-muted-foreground text-sm">
                        {value ? t('enabled') : t('disabled')}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button
                variant={group.settings.some((s) => dirty.has(s.key)) ? 'default' : 'outline'}
                onClick={() =>
                  saveGroup(
                    group.key,
                    group.settings.map((s) => s.key),
                  )
                }
                disabled={
                  !group.settings.some((s) => dirty.has(s.key)) || savingGroup === group.key
                }
              >
                <Save className="mr-1 h-4 w-4" />
                {savingGroup === group.key ? t('saving') : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
