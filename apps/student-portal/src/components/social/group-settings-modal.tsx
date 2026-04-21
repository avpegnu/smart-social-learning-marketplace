'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Label,
  Select,
} from '@shared/ui';
import { useUpdateGroup } from '@shared/hooks';
import type { UpdateGroupData } from '@shared/hooks';

interface GroupOwner {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface GroupSettings {
  id: string;
  name: string;
  description: string | null;
  privacy: 'PUBLIC' | 'PRIVATE';
  courseId?: string;
  owner: GroupOwner;
}

interface GroupSettingsModalProps {
  group: GroupSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupSettingsModal({ group, open, onOpenChange }: GroupSettingsModalProps) {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const updateGroup = useUpdateGroup();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>(group.privacy);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const isCourseGroup = !!group.courseId;
  const privacyOptions = [
    { value: 'PUBLIC', label: t('public') },
    { value: 'PRIVATE', label: t('private') },
  ];

  function validate(): boolean {
    const newErrors: { name?: string; description?: string } = {};
    if (name.trim().length < 3) {
      newErrors.name = t('nameMin');
    }
    if (name.trim().length > 100) {
      newErrors.name = t('nameMax');
    }
    if (description.length > 500) {
      newErrors.description = t('descMax');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const data: UpdateGroupData = {};

    // Only include fields that changed
    if (name.trim() !== group.name) {
      data.name = name.trim();
    }
    if (description.trim() !== (group.description ?? '')) {
      data.description = description.trim();
    }
    if (!isCourseGroup && privacy !== group.privacy) {
      data.privacy = privacy;
    }

    // If no changes, just close
    if (Object.keys(data).length === 0) {
      onOpenChange(false);
      return;
    }

    updateGroup.mutate(
      { id: group.id, data },
      {
        onSuccess: () => {
          setErrors({});
          onOpenChange(false);
        },
      },
    );
  }

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      // Reset to group data when opening
      setName(group.name);
      setDescription(group.description ?? '');
      setPrivacy(group.privacy);
      setErrors({});
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editGroupSettings')}</DialogTitle>
        </DialogHeader>

        {isCourseGroup && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
            {t('cannotEditCourseGroup')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">{t('name')}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
              maxLength={100}
              disabled={updateGroup.isPending}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">{t('description')}</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description')}
              maxLength={500}
              rows={3}
              className="resize-none"
              disabled={updateGroup.isPending}
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          {!isCourseGroup && (
            <div className="space-y-2">
              <Label htmlFor="group-privacy">{t('privacy')}</Label>
              <Select
                id="group-privacy"
                options={privacyOptions}
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as 'PUBLIC' | 'PRIVATE')}
                disabled={updateGroup.isPending}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateGroup.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={updateGroup.isPending || isCourseGroup}>
              {updateGroup.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('editGroup')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
