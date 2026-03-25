'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@shared/ui';
import { useSearchUsers, useDebounce } from '@shared/hooks';

interface SelectedUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, participantIds: string[]) => void;
  isCreating?: boolean;
}

export function NewGroupDialog({ open, onOpenChange, onCreate, isCreating }: NewGroupDialogProps) {
  const t = useTranslations('chat');
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: searchRaw } = useSearchUsers(debouncedQuery);
  const searchResults = (searchRaw as { data?: SelectedUser[] })?.data ?? [];

  const handleAddUser = useCallback(
    (user: SelectedUser) => {
      if (selectedUsers.some((u) => u.id === user.id)) return;
      setSelectedUsers((prev) => [...prev, user]);
      setSearchQuery('');
    },
    [selectedUsers],
  );

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleCreate = useCallback(() => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    onCreate(
      groupName.trim(),
      selectedUsers.map((u) => u.id),
    );
    // Reset
    setGroupName('');
    setSearchQuery('');
    setSelectedUsers([]);
  }, [groupName, selectedUsers, onCreate]);

  const filteredResults = searchResults.filter((u) => !selectedUsers.some((s) => s.id === u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newGroup')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name */}
          <div>
            <label className="text-sm font-medium">{t('groupName')}</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('groupName')}
              className="mt-1"
            />
          </div>

          {/* Selected users as chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                >
                  {user.fullName}
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="hover:text-foreground text-muted-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search users */}
          <div>
            <label className="text-sm font-medium">{t('selectMembers')}</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="mt-1"
            />
          </div>

          {/* Search results */}
          {filteredResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border">
              {filteredResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAddUser(user)}
                  className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                    <AvatarFallback className="text-[10px]">{user.fullName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{user.fullName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
          >
            {t('createGroup')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
