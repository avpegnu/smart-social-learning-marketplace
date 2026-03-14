'use client';

import { useTranslations } from 'next-intl';
import {
  Search,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  ArrowLeft,
  Circle,
} from 'lucide-react';
import { Button, Input, Avatar, AvatarFallback, Badge } from '@shared/ui';
import { mockConversations, mockMessages } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function ChatPage() {
  const t = useTranslations('chat');
  const [selectedConversation, setSelectedConversation] = useState<string | null>('c1');
  const [messageInput, setMessageInput] = useState('');

  const selectedConv = mockConversations.find((c) => c.id === selectedConversation);

  return (
    <div className="container mx-auto px-0 py-0 sm:px-4 sm:py-8">
      <div className="border-border bg-background flex h-[calc(100vh-8rem)] overflow-hidden rounded-none border sm:h-[calc(100vh-12rem)] sm:rounded-xl">
        {/* Conversations List */}
        <div
          className={cn(
            'border-border flex w-full shrink-0 flex-col border-r sm:w-80',
            selectedConversation ? 'hidden sm:flex' : 'flex',
          )}
        >
          <div className="p-4">
            <h2 className="mb-3 text-lg font-semibold">{t('title')}</h2>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input placeholder={t('searchConversations')} className="bg-muted/50 pl-9" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {mockConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                  'hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                  selectedConversation === conv.id && 'bg-accent',
                )}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{conv.user.name[0]}</AvatarFallback>
                  </Avatar>
                  {conv.user.isOnline && (
                    <Circle className="fill-success text-background absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">{conv.user.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{conv.time}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <Badge className="flex h-5 w-5 shrink-0 items-center justify-center p-0 text-[10px]">
                    {conv.unread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Panel */}
        <div
          className={cn('flex flex-1 flex-col', !selectedConversation ? 'hidden sm:flex' : 'flex')}
        >
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="border-border flex items-center gap-3 border-b px-4 py-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer sm:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{selectedConv.user.name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{selectedConv.user.name}</h3>
                  <p className="text-muted-foreground text-xs">
                    {selectedConv.user.isOnline ? t('online') : t('offline')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {mockMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.sender === 'me' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        msg.sender === 'me'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md',
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={cn(
                          'mt-1 text-[10px]',
                          msg.sender === 'me'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground',
                        )}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div
                        className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="border-border border-t p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder={t('typePlaceholder')}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setMessageInput('');
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button size="icon" className="h-9 w-9 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center">
              <p className="text-sm">{t('selectConversation')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
