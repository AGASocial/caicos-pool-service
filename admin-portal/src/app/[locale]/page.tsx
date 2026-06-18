"use client";

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation'; // Use locale-aware Link
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Users, ArrowRight, Briefcase, Building2, Route, Heart } from "lucide-react"
import { LoadingState } from '@/components/ui/loading-state';

export default function LocalePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      const response = await fetch('/api/auth/session');
      const data = response.ok ? await response.json() : { authenticated: false };

      if (data.authenticated) {
        router.replace('/dashboard');
      } else {
        // Not logged in, show landing page
        setIsLoading(false);
      }
    };

    checkSessionAndRedirect();
  }, [router]);

  if (isLoading) {
    return <LoadingState fullScreen className="bg-background" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background overflow-x-hidden">
      {/* Decorative Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[120px] mix-blend-screen" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-heading text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
                cadenza
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Link href="/auth/login">
                <Button variant="ghost" className="font-medium">Login</Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="premium" className="font-bold shadow-lg shadow-indigo-500/20">
                  Get Started
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-20 lg:py-32 px-4 sm:px-0 relative">
          <div className="container flex max-w-[64rem] flex-col items-center gap-6 text-center">
            <div className="rounded-full bg-secondary/30 px-3 py-1 text-sm font-medium text-secondary-foreground backdrop-blur-sm border border-secondary/50">
              Launch v2.0 is live 🚀
            </div>

            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 drop-shadow-sm">
              Run Your <br className="hidden sm:block" />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
                Pool Service
              </span>
            </h1>

            <p className="max-w-[42rem] leading-normal text-muted-foreground text-lg sm:text-xl sm:leading-8">
              Cadenza helps pool service companies schedule jobs, manage routes, coordinate technicians, and track service history from one admin portal.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:space-x-4 w-full sm:w-auto pt-4">
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button variant="premium" size="lg" className="w-full sm:w-auto gap-2 text-lg h-12">
                  Start for Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/about" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg h-12 backdrop-blur-md bg-card/40 border-border hover:bg-card/60">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container space-y-6 py-8 md:py-12 lg:py-24 px-4 sm:px-6 relative">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center mb-10">
            <h2 className="font-heading text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
              Built for field service teams
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Schedule recurring routes, assign technicians, and keep every property service record in one place.
            </p>
          </div>

          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card className="glass-card hover:-translate-y-1 transition-transform duration-300">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Jobs & Scheduling</CardTitle>
                <CardDescription>
                  Create ad-hoc jobs or generate them from recurring routes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Daily job lists for technicians</li>
                  <li>Route-based automation</li>
                  <li>Service history per property</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card hover:-translate-y-1 transition-transform duration-300">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Properties</CardTitle>
                <CardDescription>
                  Manage customer pools, access notes, and service preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Centralized property records</li>
                  <li>Equipment and chemical history</li>
                  <li>Photo documentation</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card hover:-translate-y-1 transition-transform duration-300">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                  <Route className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Routes & Team</CardTitle>
                <CardDescription>
                  Organize technicians, routes, and stops across your service area.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Weekly stop schedules</li>
                  <li>Role-based team access</li>
                  <li>Multi-tenant by company</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Trust Section */}
        <section className="container py-12 md:py-24 lg:py-32 px-4 border-t border-border/40">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
              Trusted by thousands
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Join pool service companies using Cadenza to run operations in the field and the office.
            </p>
            <div className="flex w-full items-center justify-center gap-8 pt-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              {/* Placeholders for logos */}
              <span className="text-xl font-bold">Acme Corp</span>
              <span className="text-xl font-bold">Stark Ind</span>
              <span className="text-xl font-bold">Wayne Ent</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background/50 py-6 md:py-0 backdrop-blur-lg">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left flex items-center gap-1">
            Built with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> by{" "}
            <a
              href="https://github.com/yourusername"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4 hover:text-primary transition-colors"
            >
              cadenza team
            </a>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
