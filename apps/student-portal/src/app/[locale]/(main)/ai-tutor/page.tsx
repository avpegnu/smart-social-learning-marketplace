'use client';

import { useTranslations } from 'next-intl';
import { Bot, Send, Plus, Sparkles, ArrowLeft, Zap } from 'lucide-react';
import { Button, Input, Avatar, AvatarFallback, Progress } from '@shared/ui';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AiMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  time: string;
}

const mockSessions = [
  {
    id: 's1',
    title: 'React Hooks',
    lastMessage: 'useEffect cleanup function...',
    time: '10:30',
    isActive: true,
  },
  {
    id: 's2',
    title: 'TypeScript Generics',
    lastMessage: 'Generic constraints...',
    time: 'Hôm qua',
    isActive: false,
  },
  {
    id: 's3',
    title: 'Next.js App Router',
    lastMessage: 'Server vs Client Components',
    time: 'T2',
    isActive: false,
  },
];

const mockAiMessages: AiMessage[] = [
  {
    id: 'm1',
    content:
      'Chào bạn! Tôi là AI Tutor, tôi có thể giúp bạn giải đáp thắc mắc về lập trình. Hôm nay bạn muốn học gì?',
    sender: 'ai',
    time: '10:20',
  },
  {
    id: 'm2',
    content:
      'Mình muốn hiểu rõ hơn về useEffect trong React. Khi nào thì cần dùng cleanup function?',
    sender: 'user',
    time: '10:22',
  },
  {
    id: 'm3',
    content: `Cleanup function trong useEffect rất quan trọng! Bạn cần dùng khi:

**1. Event listeners:** Khi bạn thêm event listener, cần remove khi component unmount.

\`\`\`javascript
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
\`\`\`

**2. Subscriptions:** Khi subscribe vào một service (WebSocket, Observable...).

**3. Timers:** setInterval, setTimeout cần được clear.

**4. API calls:** Cancel request khi component unmount (dùng AbortController).

Nếu không cleanup, bạn sẽ gặp memory leaks và bugs khó debug!`,
    sender: 'ai',
    time: '10:23',
  },
  {
    id: 'm4',
    content: 'Cảm ơn! Vậy AbortController hoạt động thế nào với fetch?',
    sender: 'user',
    time: '10:25',
  },
  {
    id: 'm5',
    content: `AbortController cho phép bạn hủy fetch request. Đây là cách sử dụng:

\`\`\`javascript
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    });

  return () => controller.abort();
}, []);
\`\`\`

Khi component unmount, cleanup function gọi \`controller.abort()\`, tự động hủy request đang pending. Lưu ý kiểm tra \`AbortError\` trong catch để không log lỗi không cần thiết!`,
    sender: 'ai',
    time: '10:26',
  },
];

export default function AiTutorPage() {
  const t = useTranslations('aiTutor');
  const [selectedSession, setSelectedSession] = useState<string | null>('s1');
  const [messageInput, setMessageInput] = useState('');
  const usageCount = 3;
  const usageLimit = 10;

  return (
    <div className="container mx-auto px-0 py-0 sm:px-4 sm:py-8">
      <div className="border-border bg-background flex h-[calc(100vh-8rem)] overflow-hidden rounded-none border sm:h-[calc(100vh-12rem)] sm:rounded-xl">
        {/* Sessions List */}
        <div
          className={cn(
            'border-border flex w-full shrink-0 flex-col border-r sm:w-72',
            selectedSession ? 'hidden sm:flex' : 'flex',
          )}
        >
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Bot className="text-primary h-5 w-5" />
                {t('title')}
              </h2>
            </div>
            <Button variant="outline" className="w-full gap-2" size="sm">
              <Plus className="h-4 w-4" />
              {t('newSession')}
            </Button>
          </div>

          {/* Usage counter */}
          <div className="px-4 py-2">
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {t('usage')}
              </span>
              <span>
                {usageCount}/{usageLimit}
              </span>
            </div>
            <Progress value={(usageCount / usageLimit) * 100} className="h-1.5" />
          </div>

          <div className="mt-2 flex-1 overflow-y-auto">
            {mockSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={cn(
                  'hover:bg-accent/50 w-full cursor-pointer px-4 py-3 text-left transition-colors',
                  selectedSession === session.id && 'bg-accent',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{session.title}</span>
                  <span className="text-muted-foreground text-xs">{session.time}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {session.lastMessage}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <div className={cn('flex flex-1 flex-col', !selectedSession ? 'hidden sm:flex' : 'flex')}>
          {selectedSession ? (
            <>
              {/* Header */}
              <div className="border-border flex items-center gap-3 border-b px-4 py-3">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer sm:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-medium">AI Tutor</h3>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    {t('poweredBy')}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {mockAiMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div className="flex max-w-[80%] items-start gap-2">
                      {msg.sender === 'ai' && (
                        <Avatar className="mt-1 h-7 w-7 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary">
                            <Bot className="h-3.5 w-3.5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2',
                          msg.sender === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md',
                        )}
                      >
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                        <p
                          className={cn(
                            'mt-1 text-[10px]',
                            msg.sender === 'user'
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground',
                          )}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Usage banner */}
              <div className="bg-muted/50 px-4 py-2 text-center">
                <p className="text-muted-foreground text-xs">
                  {t('usageRemaining', { count: usageLimit - usageCount, limit: usageLimit })}
                </p>
              </div>

              {/* Input */}
              <div className="border-border border-t p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('askPlaceholder')}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setMessageInput('');
                    }}
                  />
                  <Button size="icon" className="h-10 w-10 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
              <Bot className="text-primary/30 mb-4 h-16 w-16" />
              <h2 className="mb-2 text-lg font-semibold">{t('welcomeTitle')}</h2>
              <p className="text-muted-foreground max-w-md text-sm">{t('welcomeDesc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
