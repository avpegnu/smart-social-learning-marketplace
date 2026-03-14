'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  Button,
  Input,
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { adminCategories } from '@/lib/mock-data';

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('addCategory')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('slug')}</TableHead>
                <TableHead className="text-right">{t('courseCount')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminCategories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-2 py-0.5 text-xs">{cat.slug}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cat.courseCount}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[250px] truncate text-sm">
                    {cat.description}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('name')}</label>
              <Input placeholder="e.g. Cloud Computing" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('slug')}</label>
              <Input placeholder="e.g. cloud-computing" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('description')}</label>
              <textarea
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                placeholder="Description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={() => setDialogOpen(false)}>{tc('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
