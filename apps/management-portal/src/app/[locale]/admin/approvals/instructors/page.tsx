'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  Button,
  AvatarSimple,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui';
import { Check, X, Eye, ExternalLink } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { instructorApplications, type InstructorApplication } from '@/lib/mock-data';

export default function InstructorApprovalsPage() {
  const t = useTranslations('approvals');
  const [selectedApp, setSelectedApp] = React.useState<InstructorApplication | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('instructorTitle')}</h1>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('expertise')}</TableHead>
                <TableHead>{t('appliedDate')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructorApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AvatarSimple alt={app.name} size="sm" />
                      <span className="font-medium">{app.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{app.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {app.expertise}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(app.appliedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedApp(app)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-success h-8 w-8">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('viewDetails')}</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AvatarSimple alt={selectedApp.name} size="lg" />
                <div>
                  <p className="text-lg font-semibold">{selectedApp.name}</p>
                  <p className="text-muted-foreground text-sm">{selectedApp.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-muted-foreground text-xs">{t('expertise')}</p>
                  <p className="text-sm font-medium">{selectedApp.expertise}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('appliedDate')}</p>
                  <p className="text-sm font-medium">{formatDate(selectedApp.appliedAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">{t('experience')}</p>
                <p className="text-sm">{selectedApp.experience}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">{t('bio')}</p>
                <p className="text-sm">{selectedApp.bio}</p>
              </div>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('linkedIn')}
                </a>
                <a
                  href="#"
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('portfolio')}
                </a>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => setSelectedApp(null)}>
                  <X className="h-4 w-4" />
                  {t('reject')}
                </Button>
                <Button onClick={() => setSelectedApp(null)}>
                  <Check className="h-4 w-4" />
                  {t('approve')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
