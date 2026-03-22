'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Project, ProjectStatus } from '@/shared/types';
import { createProject, getProjectsByCompany } from '@/modules/projects/services/projectsService';

const PROJECT_STATUS_CLASSNAMES: Record<ProjectStatus, string> = {
  planned: 'bg-slate-700 text-slate-200 border border-slate-600',
  'in-progress': 'bg-blue-900/40 text-blue-300 border border-blue-700',
  completed: 'bg-green-900/40 text-green-300 border border-green-700',
};

const getProjectStatusLabel = (status: ProjectStatus, t: any): string => {
  const labels: Record<ProjectStatus, string> = {
    planned: t('projects.statusPlanned'),
    'in-progress': t('projects.statusInProgress'),
    completed: t('projects.statusCompleted'),
  };
  return labels[status];
};

const toTimestamp = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const formatDate = (value: unknown): string => {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Date not specified';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
};

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const t = useTranslations();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('planned');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.companyId) return;

      try {
        const data = await getProjectsByCompany(user.companyId);
        const sorted = [...data].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
        setProjects(sorted);
      } catch (err) {
        console.error('Error loading projects:', err);
      }
    };

    loadProjects();
  }, [user?.companyId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user?.companyId) {
      setError(t('auth.alert.userCompanyNotFound'));
      return;
    }

    if (!projectTitle.trim() || !projectDescription.trim()) {
      setError(t('auth.alert.projectTitleDescriptionRequired'));
      return;
    }

    setSubmitting(true);

    try {
      const newProject = await createProject({
        companyId: user.companyId,
        title: projectTitle.trim(),
        description: projectDescription.trim(),
        status: projectStatus,
      });

      setProjects((prev) => [newProject, ...prev]);
      setProjectTitle('');
      setProjectDescription('');
      setProjectStatus('planned');
      setShowCreateForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.alert.projectCreateError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-white">{t('projects.loading')}</div>;
  }

  if (!user) {
    return <div className="text-white">{t('projects.loginRequired')}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← {t('projects.back')}
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('projects.title')}</h1>
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + {t('projects.addProject')}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showCreateForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">{t('projects.newProject')}</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">{t('projects.projectName')}</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Например: Капитальный ремонт подъезда"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">{t('projects.description')}</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Кратко опишите цель и этапы проекта"
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">{t('projects.status')}</label>
                <select
                  value={projectStatus}
                  onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                >
                  <option value="planned">{t('projects.statusPlanned')}</option>
                  <option value="in-progress">{t('projects.statusInProgress')}</option>
                  <option value="completed">{t('projects.statusCompleted')}</option>
                </select>
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-900/30 border border-red-700 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? t('projects.saving') : t('projects.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 hover:bg-slate-600 transition"
                >
                  {t('projects.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('projects.noProjects')}</h2>
            <p className="text-gray-400 mb-6">{t('projects.addFirstProject')}</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {t('projects.newProject')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                    <p className="text-gray-400 mt-2 whitespace-pre-line">{project.description}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PROJECT_STATUS_CLASSNAMES[project.status]}`}
                  >
                    {getProjectStatusLabel(project.status, t)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  {t('projects.created')} {formatDate(project.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
