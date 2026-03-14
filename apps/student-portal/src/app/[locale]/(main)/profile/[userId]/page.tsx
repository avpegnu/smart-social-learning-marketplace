'use client';

import { useTranslations } from 'next-intl';
import {
  MapPin,
  Calendar,
  Github,
  Linkedin,
  Globe,
  UserPlus,
  MessageCircle,
  BookOpen,
  Award,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Progress,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { mockPosts, mockCertificates } from '@/lib/mock-data';

export default function ProfilePage() {
  const t = useTranslations('profile');

  const user = {
    name: 'Nguyễn Minh Tuấn',
    bio: 'Frontend Developer | React Enthusiast | Lifelong Learner',
    location: 'Ho Chi Minh City, Vietnam',
    joinDate: '2024-06-15',
    followers: 128,
    following: 45,
    coursesCompleted: 5,
    socialLinks: {
      github: 'https://github.com/minhtuan',
      linkedin: 'https://linkedin.com/in/minhtuan',
      website: 'https://minhtuan.dev',
    },
  };

  const skills = [
    { name: 'React', level: 85 },
    { name: 'TypeScript', level: 72 },
    { name: 'Next.js', level: 68 },
    { name: 'Node.js', level: 55 },
    { name: 'CSS', level: 78 },
    { name: 'Git', level: 90 },
  ];

  const completedCourses = [
    'React & Next.js Full-Stack từ Zero đến Hero',
    'Flutter - Phát triển ứng dụng Mobile',
    'Node.js & Express.js - Xây dựng REST API',
    'UI/UX Design với Figma',
    'Docker & Kubernetes cho DevOps',
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                MT
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-muted-foreground mt-1">{user.bio}</p>

              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {user.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('joined')}{' '}
                  {new Date(user.joinDate).toLocaleDateString('vi-VN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-6">
                <div className="text-center">
                  <div className="font-bold">{user.followers}</div>
                  <div className="text-muted-foreground text-xs">{t('followers')}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{user.following}</div>
                  <div className="text-muted-foreground text-xs">{t('following')}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{user.coursesCompleted}</div>
                  <div className="text-muted-foreground text-xs">{t('coursesCompleted')}</div>
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-4 flex items-center gap-2">
                <a
                  href={user.socialLinks.github}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-5 w-5" />
                </a>
                <a
                  href={user.socialLinks.linkedin}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
                <a
                  href={user.socialLinks.website}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                {t('follow')}
              </Button>
              <Button variant="outline" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                {t('message')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="mb-6">
          <TabsTrigger value="posts">{t('postsTab')}</TabsTrigger>
          <TabsTrigger value="courses">{t('coursesTab')}</TabsTrigger>
          <TabsTrigger value="skills">{t('skillsTab')}</TabsTrigger>
          <TabsTrigger value="certificates">{t('certificatesTab')}</TabsTrigger>
        </TabsList>

        {/* Posts */}
        <TabsContent value="posts">
          <div className="max-w-2xl space-y-4">
            {mockPosts.slice(0, 2).map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <p className="text-sm">{post.content}</p>
                  <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                    <span>{post.createdAt}</span>
                    <span>{post.likes} likes</span>
                    <span>{post.comments} comments</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Courses Completed */}
        <TabsContent value="courses">
          <div className="max-w-2xl space-y-2">
            {completedCourses.map((course) => (
              <Card key={course}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="bg-success/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <BookOpen className="text-success h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{course}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Skills */}
        <TabsContent value="skills">
          <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map(({ name, level }) => (
              <Card key={name}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-muted-foreground text-xs">{level}%</span>
                  </div>
                  <Progress value={level} className="h-1.5" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Certificates */}
        <TabsContent value="certificates">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockCertificates.map((cert) => (
              <Card key={cert.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Award className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <span className="line-clamp-1 text-sm font-medium">{cert.courseTitle}</span>
                    <p className="text-muted-foreground text-xs">
                      {new Date(cert.completionDate).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
