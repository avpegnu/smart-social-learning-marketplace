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
import { useCreateGroup } from '@shared/hooks';
import type { CreateGroupData } from '@shared/hooks';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateGroupData = {
      name: name.trim(),
      privacy,
    };
    if (description.trim()) {
      data.description = description.trim();
    }

    createGroup.mutate(data, {
      onSuccess: () => {
        setName('');
        setDescription('');
        setPrivacy('PUBLIC');
        setErrors({});
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createGroup')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">{t('name')}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
              maxLength={100}
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
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-privacy">{t('privacy')}</Label>
            <Select
              id="group-privacy"
              options={privacyOptions}
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as 'PUBLIC' | 'PRIVATE')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createGroup.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {createGroup.isPending ? t('creating') : t('createGroup')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
