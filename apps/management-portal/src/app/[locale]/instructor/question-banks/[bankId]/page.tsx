'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle2, Circle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, Input, Label, Textarea, Skeleton } from '@shared/ui';
import {
  useQuestionBankDetail,
  useUpdateQuestionBank,
  useDeleteQuestionBank,
  useAddBankQuestion,
  useUpdateBankQuestion,
  useDeleteBankQuestion,
  useAddBankQuestionsBatch,
} from '@shared/hooks';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ImportQuizDialog } from '@/components/courses/wizard/import-quiz-dialog';
import { Link } from '@/i18n/navigation';

// Types
interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionBankItem {
  id: string;
  question: string;
  explanation: string | null;
  order: number;
  options: QuestionOption[];
}

interface QuestionBankDetail {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  questions: QuestionBankItem[];
}

interface OptionFormData {
  text: string;
  isCorrect: boolean;
}

interface QuestionFormData {
  question: string;
  explanation: string;
  options: OptionFormData[];
}

const EMPTY_QUESTION_FORM: QuestionFormData = {
  question: '',
  explanation: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
};

export default function QuestionBankDetailPage() {
  const t = useTranslations('questionBanks');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const bankId = params.bankId as string;

  // State
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [showEditBank, setShowEditBank] = useState(false);
  const [showDeleteBank, setShowDeleteBank] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [showImportText, setShowImportText] = useState(false);
  const [questionForm, setQuestionForm] = useState<QuestionFormData>(EMPTY_QUESTION_FORM);

  // Queries & Mutations
  const { data: raw, isLoading } = useQuestionBankDetail(bankId);
  const updateBank = useUpdateQuestionBank();
  const deleteBank = useDeleteQuestionBank();
  const addQuestion = useAddBankQuestion();
  const addQuestionsBatch = useAddBankQuestionsBatch();
  const updateQuestion = useUpdateBankQuestion();
  const deleteQuestion = useDeleteBankQuestion();

  const bank = (raw as { data?: QuestionBankDetail })?.data as QuestionBankDetail | undefined;

  // Handlers
  const handleUpdateBank = () => {
    updateBank.mutate(
      {
        bankId,
        data: {
          name: nameValue.trim() || undefined,
          description: descValue.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('bankUpdated'));
          setShowEditBank(false);
        },
      },
    );
  };

  const handleDeleteBank = () => {
    deleteBank.mutate(bankId, {
      onSuccess: () => {
        toast.success(t('bankDeleted'));
        router.push('/instructor/question-banks');
      },
    });
  };

  const openAddQuestion = () => {
    setEditingQuestionId(null);
    setQuestionForm(EMPTY_QUESTION_FORM);
    setShowQuestionForm(true);
  };

  const openEditQuestion = (q: QuestionBankItem) => {
    setEditingQuestionId(q.id);
    setQuestionForm({
      question: q.question,
      explanation: q.explanation ?? '',
      options: q.options
        .sort((a, b) => a.order - b.order)
        .map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    });
    setShowQuestionForm(true);
  };

  const validateQuestionForm = (): boolean => {
    if (!questionForm.question.trim()) {
      toast.error(t('questionRequired'));
      return false;
    }
    const validOptions = questionForm.options.filter((o) => o.text.trim());
    if (validOptions.length < 2) {
      toast.error(t('atLeastTwoOptions'));
      return false;
    }
    if (!validOptions.some((o) => o.isCorrect)) {
      toast.error(t('oneCorrectRequired'));
      return false;
    }
    return true;
  };

  const handleSaveQuestion = () => {
    if (!validateQuestionForm()) return;

    const payload = {
      question: questionForm.question.trim(),
      explanation: questionForm.explanation.trim() || undefined,
      options: questionForm.options
        .filter((o) => o.text.trim())
        .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
    };

    if (editingQuestionId) {
      updateQuestion.mutate(
        { bankId, questionId: editingQuestionId, data: payload },
        {
          onSuccess: () => {
            toast.success(t('questionUpdated'));
            setShowQuestionForm(false);
          },
        },
      );
    } else {
      addQuestion.mutate(
        { bankId, data: payload },
        {
          onSuccess: () => {
            toast.success(t('questionAdded'));
            setShowQuestionForm(false);
          },
        },
      );
    }
  };

  const handleDeleteQuestion = () => {
    if (!deleteQuestionId) return;
    deleteQuestion.mutate(
      { bankId, questionId: deleteQuestionId },
      {
        onSuccess: () => {
          toast.success(t('questionDeleted'));
          setDeleteQuestionId(null);
        },
      },
    );
  };

  // Option helpers
  const updateOption = (index: number, field: keyof OptionFormData, value: string | boolean) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }));
  };

  const toggleCorrect = (index: number) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => ({ ...o, isCorrect: i === index })),
    }));
  };

  const addOption = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [...prev.options, { text: '', isCorrect: false }],
    }));
  };

  const removeOption = (index: number) => {
    if (questionForm.options.length <= 2) return;
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="space-y-4">
        <Link
          href="/instructor/question-banks"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <p className="text-muted-foreground">{tCommon('noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/instructor/question-banks"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>

        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{bank.name}</h1>
            {bank.description && (
              <p className="text-muted-foreground mt-1 text-sm">{bank.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameValue(bank.name);
                setDescValue(bank.description ?? '');
                setShowEditBank(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('editBank')}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteBank(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('deleteBank')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <p className="text-muted-foreground text-sm">{t('totalQuestions')}</p>
            <p className="text-2xl font-bold tabular-nums">{bank.questions?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      {/* Questions Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('questionCount')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportText(true)}>
            <FileText className="mr-2 h-4 w-4" />
            {t('importFromText')}
          </Button>
          <Button onClick={openAddQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addQuestion')}
          </Button>
        </div>
      </div>

      {/* Question List */}
      {!bank.questions || bank.questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">{t('noQuestions')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bank.questions
            .sort((a, b) => a.order - b.order)
            .map((q, idx) => (
              <div key={q.id} className="border-border space-y-3 rounded-lg border p-4">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5 text-sm font-medium">
                    {idx + 1}.
                  </span>
                  <p className="flex-1 font-medium">{q.question}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => openEditQuestion(q)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8 shrink-0"
                    onClick={() => setDeleteQuestionId(q.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5 pl-6">
                  {q.options
                    .sort((a, b) => a.order - b.order)
                    .map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        {opt.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                        ) : (
                          <Circle className="text-muted-foreground h-5 w-5 shrink-0" />
                        )}
                        <span
                          className={
                            opt.isCorrect ? 'text-sm font-medium' : 'text-muted-foreground text-sm'
                          }
                        >
                          {opt.text}
                        </span>
                      </div>
                    ))}
                </div>
                {q.explanation && (
                  <p className="text-muted-foreground pl-6 text-sm">
                    {t('explanation')}: {q.explanation}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Edit Bank Dialog */}
      <ConfirmDialog
        open={showEditBank}
        onOpenChange={(open) => !open && setShowEditBank(false)}
        title={t('editBank')}
        description=""
        confirmLabel={tCommon('save')}
        onConfirm={handleUpdateBank}
        isLoading={updateBank.isPending}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input
              placeholder={t('namePlaceholder')}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea
              placeholder={t('descriptionPlaceholder')}
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* Delete Bank Dialog */}
      <ConfirmDialog
        open={showDeleteBank}
        onOpenChange={(open) => !open && setShowDeleteBank(false)}
        title={t('deleteBank')}
        description={t('confirmDeleteBank')}
        onConfirm={handleDeleteBank}
        isLoading={deleteBank.isPending}
        variant="destructive"
      />

      {/* Add/Edit Question Dialog */}
      <ConfirmDialog
        open={showQuestionForm}
        onOpenChange={(open) => !open && setShowQuestionForm(false)}
        title={editingQuestionId ? t('editQuestion') : t('addQuestion')}
        description=""
        confirmLabel={tCommon('save')}
        onConfirm={handleSaveQuestion}
        isLoading={addQuestion.isPending || updateQuestion.isPending}
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1 pt-2">
          {/* Question text */}
          <div className="space-y-1">
            <Label className="text-sm">{t('questionText')}</Label>
            <Input
              placeholder={t('questionPlaceholder')}
              value={questionForm.question}
              onChange={(e) => setQuestionForm((prev) => ({ ...prev, question: e.target.value }))}
            />
          </div>

          {/* Options — radio style like quiz builder */}
          <div className="space-y-1">
            <Label className="text-sm">{t('options')}</Label>
            <div className="space-y-2">
              {questionForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleCorrect(idx)} className="shrink-0">
                    {opt.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="text-muted-foreground h-5 w-5" />
                    )}
                  </button>
                  <Input
                    value={opt.text}
                    onChange={(e) => updateOption(idx, 'text', e.target.value)}
                    placeholder={`${t('option')} ${String.fromCharCode(65 + idx)}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-7 w-7"
                    onClick={() => removeOption(idx)}
                    disabled={questionForm.options.length <= 2}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addOption} className="ml-7">
              <Plus className="mr-1 h-3 w-3" />
              {t('addOption')}
            </Button>
          </div>

          {/* Explanation */}
          <div className="space-y-1">
            <Label className="text-sm">{t('explanation')}</Label>
            <Input
              placeholder={t('explanationPlaceholder')}
              value={questionForm.explanation}
              onChange={(e) =>
                setQuestionForm((prev) => ({ ...prev, explanation: e.target.value }))
              }
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* Delete Question Dialog */}
      <ConfirmDialog
        open={!!deleteQuestionId}
        onOpenChange={(open) => !open && setDeleteQuestionId(null)}
        title={t('deleteQuestion')}
        description={t('confirmDeleteQuestion')}
        onConfirm={handleDeleteQuestion}
        isLoading={deleteQuestion.isPending}
        variant="destructive"
      />

      {/* Import From Text Dialog */}
      <ImportQuizDialog
        open={showImportText}
        onClose={() => setShowImportText(false)}
        onImport={(parsed) => {
          const questions = parsed.map((q) => ({
            question: q.question,
            explanation: q.explanation ?? '',
            options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          }));
          addQuestionsBatch.mutate(
            { bankId, questions },
            {
              onSuccess: () => {
                toast.success(t('imported'));
                setShowImportText(false);
              },
            },
          );
        }}
      />
    </div>
  );
}
