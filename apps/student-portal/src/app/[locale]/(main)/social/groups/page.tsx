'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Search, Plus, Users } from 'lucide-react';
import { Button, Input, Card, CardContent, Avatar, AvatarFallback, Badge } from '@shared/ui';
import { mockGroups } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function GroupsPage() {
  const t = useTranslations('groups');
  const [search, setSearch] = useState('');

  const filteredGroups = mockGroups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('createGroup')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input
          placeholder={t('searchPlaceholder')}
          className="h-12 rounded-xl pl-12"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredGroups.map((group) => (
          <Link key={group.id} href={`/social/groups/${group.id}`}>
            <Card className="h-full transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-4">
                <div className="mb-3 flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {group.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-sm font-semibold">{group.name}</h3>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      <span>
                        {group.memberCount.toLocaleString()} {t('members')}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">
                  {group.description}
                </p>

                <Badge variant="secondary" className="mb-3 text-xs">
                  {group.category}
                </Badge>

                <div className="mt-auto">
                  <Button
                    variant={group.isJoined ? 'outline' : 'default'}
                    size="sm"
                    className={cn('w-full', group.isJoined && 'text-muted-foreground')}
                    onClick={(e) => e.preventDefault()}
                  >
                    {group.isJoined ? t('joined') : t('join')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
