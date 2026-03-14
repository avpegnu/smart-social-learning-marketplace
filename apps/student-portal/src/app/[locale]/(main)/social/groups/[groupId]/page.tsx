'use client';

import { useTranslations } from 'next-intl';
import {
  Users,
  Shield,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Image,
  Send,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  AvatarFallback,
  Input,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { mockGroups, mockPosts } from '@/lib/mock-data';
import { useState } from 'react';

export default function GroupDetailPage() {
  const t = useTranslations('groupDetail');
  const group = mockGroups[0];
  const [isJoined, setIsJoined] = useState(group.isJoined);

  const members = [
    { name: 'Nguyễn Văn An', title: 'Senior Full-Stack Developer', role: 'admin' },
    { name: 'Trần Thị Bình', title: 'AI/ML Engineer', role: 'member' },
    { name: 'Lê Minh Cường', title: 'Mobile Developer Lead', role: 'member' },
    { name: 'Phạm Hoàng Dũng', title: 'DevOps Architect', role: 'member' },
    { name: 'Nguyễn Minh Tuấn', title: 'Student', role: 'member' },
    { name: 'Trần Hương Giang', title: 'Frontend Developer', role: 'member' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Group Header */}
      <Card className="mb-6 overflow-hidden">
        <div className="from-primary/30 to-primary/5 h-40 bg-gradient-to-br" />
        <CardContent className="-mt-12 p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <Avatar className="border-background h-20 w-20 border-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {group.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{group.name}</h1>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span>
                  {group.memberCount.toLocaleString()} {t('members')}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{group.description}</p>
            </div>
            <Button
              variant={isJoined ? 'outline' : 'default'}
              onClick={() => setIsJoined(!isJoined)}
            >
              {isJoined ? t('leaveGroup') : t('joinGroup')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="mb-6">
          <TabsTrigger value="posts">{t('posts')}</TabsTrigger>
          <TabsTrigger value="members">{t('membersTab')}</TabsTrigger>
          <TabsTrigger value="about">{t('about')}</TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts">
          <div className="max-w-2xl space-y-4">
            {/* Post Composer */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      MT
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      placeholder={t('composerPlaceholder')}
                      className="bg-muted/50 border-0"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                        <Image className="h-4 w-4" />
                        {t('photo')}
                      </Button>
                      <div className="ml-auto">
                        <Button size="sm" className="gap-1.5">
                          <Send className="h-3.5 w-3.5" />
                          {t('post')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Posts */}
            {mockPosts.slice(0, 3).map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-sm font-semibold">{post.author.name}</span>
                          <p className="text-muted-foreground text-xs">{post.author.title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">{post.createdAt}</span>
                          <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm whitespace-pre-wrap">{post.content}</p>

                      <Separator className="my-3" />

                      <div className="flex items-center gap-1">
                        <button className="text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
                          <ThumbsUp className="h-4 w-4" />
                          {post.likes}
                        </button>
                        <button className="text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
                          <MessageCircle className="h-4 w-4" />
                          {post.comments}
                        </button>
                        <button className="text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
                          <Share2 className="h-4 w-4" />
                          {post.shares}
                        </button>
                        <button className="text-muted-foreground hover:text-foreground ml-auto cursor-pointer">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="max-w-2xl space-y-2">
            {members.map((member) => (
              <Card key={member.name}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{member.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{member.name}</span>
                        {member.role === 'admin' && (
                          <span className="text-primary flex items-center gap-0.5 text-[10px] font-medium">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">{member.title}</p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0">
                      {t('viewProfile')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold">{t('groupRules')}</h3>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {group.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {i + 1}
                      </span>
                      {rule}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold">{t('admins')}</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.admins.map((admin) => (
                    <div key={admin.name} className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{admin.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-sm font-semibold">{admin.name}</span>
                        <div className="text-primary flex items-center gap-1 text-xs">
                          <Shield className="h-3 w-3" />
                          Admin
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">
                  {t('createdOn')}: {new Date(group.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
