'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  MessageCircle,
  Share2,
  Image,
  Send,
  MoreHorizontal,
  Users,
  TrendingUp,
  Bookmark,
  Plus,
  ThumbsUp,
  Hash,
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
} from '@shared/ui';
import { mockPosts } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function PostCard({ post }: { post: (typeof mockPosts)[0] }) {
  const _t = useTranslations('social');
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);

  const toggleLike = () => {
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  };

  return (
    <Card>
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

            {post.image && (
              <div className="bg-muted mt-3 flex aspect-video items-center justify-center rounded-lg">
                <Image className="text-muted-foreground/30 h-8 w-8" />
              </div>
            )}

            <Separator className="my-3" />

            <div className="flex items-center gap-1">
              <button
                onClick={toggleLike}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  liked ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <ThumbsUp className={cn('h-4 w-4', liked && 'fill-primary')} />
                {likeCount}
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
  );
}

export default function SocialPage() {
  const t = useTranslations('social');

  const groups = [
    { name: 'React Việt Nam', members: 1200 },
    { name: 'Python AI/ML', members: 850 },
    { name: 'Flutter Dev', members: 620 },
  ];

  const trending = [
    { tag: 'NextJS15', posts: 234 },
    { tag: 'ReactHooks', posts: 189 },
    { tag: 'TailwindCSS', posts: 156 },
    { tag: 'TypeScript', posts: 145 },
  ];

  const suggestions = [
    { name: 'Trần Thị Bình', title: 'AI/ML Engineer' },
    { name: 'Phạm Hoàng Dũng', title: 'DevOps Architect' },
    { name: 'Hoàng Thị Mai', title: 'UX Designer' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        {/* Left Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <Card className="sticky top-20">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">MT</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-semibold">Minh Tuấn</h3>
                  <p className="text-muted-foreground text-xs">Student</p>
                </div>
              </div>

              <Separator className="mb-4" />

              <nav className="space-y-1">
                <Link
                  href="/my-learning"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                >
                  <Bookmark className="h-4 w-4" />
                  {t('myLearning')}
                </Link>
                <Link
                  href="/social"
                  className="bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium"
                >
                  <Hash className="h-4 w-4" />
                  {t('feed')}
                </Link>
                <Link
                  href="/chat"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t('messages')}
                </Link>
              </nav>

              <Separator className="my-4" />

              <h4 className="text-muted-foreground mb-2 text-xs font-semibold">{t('groups')}</h4>
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.name}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm"
                  >
                    <Users className="text-muted-foreground h-4 w-4" />
                    <span className="truncate">{group.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Feed */}
        <div className="max-w-2xl min-w-0 flex-1">
          {/* Post Composer */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">MT</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input placeholder={t('composerPlaceholder')} className="bg-muted/50 border-0" />
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

          {/* Feed */}
          <div className="space-y-4">
            {mockPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Load more placeholder */}
          <div className="py-8 text-center">
            <Button variant="outline">{t('loadMore')}</Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-20 space-y-4">
            {/* Trending */}
            <Card>
              <CardHeader className="pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  {t('trending')}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trending.map(({ tag, posts }) => (
                    <div key={tag} className="flex items-center justify-between">
                      <span className="text-primary text-sm font-medium">#{tag}</span>
                      <span className="text-muted-foreground text-xs">
                        {posts} {t('posts')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Follow Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <h3 className="text-sm font-semibold">{t('suggestions')}</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suggestions.map((user) => (
                    <div key={user.name} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{user.name}</div>
                        <div className="text-muted-foreground truncate text-xs">{user.title}</div>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs">
                        <Plus className="mr-1 h-3 w-3" />
                        {t('follow')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile FAB */}
      <button className="bg-primary text-primary-foreground fixed right-4 bottom-20 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-lg md:hidden">
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
