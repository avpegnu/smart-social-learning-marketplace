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
import { Save, Trash2, Plus, Edit2 } from 'lucide-react';
import {
  useAdminSettings,
  useUpdateSetting,
  useAdminCommissionTiers,
  useCreateCommissionTier,
  useDeleteCommissionTier,
  useUpdateCommissionTier,
} from '@shared/hooks';
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
  const { data: tiersData } = useAdminCommissionTiers();
  const updateMutation = useUpdateSetting();
  const createTierMutation = useCreateCommissionTier();
  const deleteTierMutation = useDeleteCommissionTier();
  const updateTierMutation = useUpdateCommissionTier();

  const [serverValues, setServerValues] = useState<Record<string, unknown>>({});
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [newTier, setNewTier] = useState({ minRevenue: 0, rate: 0 }); // rate in %
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<{ minRevenue: number; rate: number } | null>(null);

  const settings = (data?.data as SettingRecord[]) ?? [];
  const tiers = (tiersData?.data as Array<{ id: string; minRevenue: number; rate: number }>) ?? [];

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
  }, [data]);

  const updateLocal = (key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
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

  const handleCreateTier = async () => {
    if (newTier.minRevenue < 0) {
      toast.error('Min revenue cannot be negative');
      return;
    }
    if (newTier.rate < 0 || newTier.rate > 100) {
      toast.error('Rate must be between 0-100%');
      return;
    }
    const rateDecimal = newTier.rate / 100;
    await createTierMutation.mutateAsync({ minRevenue: newTier.minRevenue, rate: rateDecimal });
    setNewTier({ minRevenue: 0, rate: 0 });
  };

  const hasInitialized =
    Object.keys(serverValues).length > 0 || (settings.length === 0 && !isLoading);

  if (!hasInitialized) {
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
          <CardContent className="space-y-5">
            {/* Commission Tiers Section */}
            {group.key === 'commission' && (
              <div className="space-y-3 border-b pb-4">
                <div>
                  <p className="text-sm font-semibold">{t('commissionTiers')}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{t('commissionTiersDesc')}</p>
                </div>

                {/* Tiers List */}
                {tiers.length > 0 && (
                  <div className="divide-y rounded-lg border">
                    {tiers.map((tier) => (
                      <TierRow
                        key={tier.id}
                        tier={tier}
                        isEditing={editingTierId === tier.id}
                        editingData={editingTier}
                        onEditStart={() => {
                          setEditingTierId(tier.id);
                          setEditingTier({
                            minRevenue: tier.minRevenue,
                            rate: tier.rate * 100,
                          });
                        }}
                        onEditChange={(field, value) => {
                          if (editingTier) {
                            setEditingTier({ ...editingTier, [field]: value });
                          }
                        }}
                        onEditSave={async () => {
                          if (!editingTier) return;
                          if (editingTier.minRevenue < 0) {
                            toast.error(t('minRevenueNegative'));
                            return;
                          }
                          if (editingTier.rate < 0 || editingTier.rate > 100) {
                            toast.error(t('rateInvalid'));
                            return;
                          }
                          await updateTierMutation.mutateAsync({
                            id: tier.id,
                            data: {
                              minRevenue: editingTier.minRevenue,
                              rate: editingTier.rate / 100,
                            },
                          });
                          setEditingTierId(null);
                          setEditingTier(null);
                        }}
                        onEditCancel={() => {
                          setEditingTierId(null);
                          setEditingTier(null);
                        }}
                        onDelete={() => deleteTierMutation.mutate(tier.id)}
                        isDeleting={deleteTierMutation.isPending}
                        isUpdating={updateTierMutation.isPending}
                        t={t}
                      />
                    ))}
                  </div>
                )}

                {tiers.length === 0 && (
                  <p className="text-muted-foreground py-2 text-sm">{t('noTiersConfigured')}</p>
                )}

                {/* Add New Tier */}
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">{t('addNewTier')}</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t('minRevenue')}
                      min="0"
                      value={newTier.minRevenue}
                      onChange={(e) =>
                        setNewTier({ ...newTier, minRevenue: Number(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      placeholder={t('rate')}
                      min="0"
                      max="100"
                      step="1"
                      value={newTier.rate}
                      onChange={(e) => setNewTier({ ...newTier, rate: Number(e.target.value) })}
                    />
                    <Button onClick={handleCreateTier} disabled={createTierMutation.isPending}>
                      <Plus className="mr-1 h-4 w-4" />
                      {t('addNewTier')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Regular Settings */}
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

            {/* Save Button */}
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

interface TierRowProps {
  tier: { id: string; minRevenue: number; rate: number };
  isEditing: boolean;
  editingData: { minRevenue: number; rate: number } | null;
  onEditStart: () => void;
  onEditChange: (field: string, value: number) => void;
  onEditSave: () => Promise<void>;
  onEditCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
  t: ReturnType<typeof useTranslations>;
}

function TierRow({
  tier,
  isEditing,
  editingData,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  isDeleting,
  isUpdating,
  t,
}: TierRowProps) {
  return (
    <div
      className={isEditing ? 'bg-muted/30 space-y-3 p-3' : 'flex items-center justify-between p-3'}
    >
      {isEditing && editingData ? (
        <>
          <div className="w-full space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">{t('minRevenue')}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={editingData.minRevenue}
                  onChange={(e) => onEditChange('minRevenue', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">{t('rate')}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0-100"
                  value={editingData.rate}
                  onChange={(e) => onEditChange('rate', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onEditCancel}>
                {t('cancel')}
              </Button>
              <Button size="sm" onClick={onEditSave} disabled={isUpdating}>
                <Save className="mr-1 h-3 w-3" />
                {t('save')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="font-medium">
              {t('minRevenue')}: {tier.minRevenue.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('rate')}: {(tier.rate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEditStart}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
