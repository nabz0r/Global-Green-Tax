'use client';

import { PageTransition } from '@/components/dashboard/page-transition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
  return (
    <PageTransition>
      <div className="p-8 space-y-8 max-w-[900px] mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parametres</h1>
          <p className="mt-1 text-muted-foreground">
            Gerez votre organisation et vos preferences
          </p>
        </div>

        {/* Organization */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>Informations de votre entreprise</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom de l'entreprise</Label>
                <Input defaultValue="GreenTech Luxembourg SARL" />
              </div>
              <div className="space-y-2">
                <Label>Numero TVA</Label>
                <Input defaultValue="LU12345678" />
              </div>
              <div className="space-y-2">
                <Label>Secteur d'activite</Label>
                <Input defaultValue="Technology" />
              </div>
              <div className="space-y-2">
                <Label>Pays principal</Label>
                <Input defaultValue="Luxembourg" disabled />
              </div>
            </div>
            <Button>Sauvegarder</Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Apparence</CardTitle>
            <CardDescription>Personnalisez l'interface</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mode sombre / clair</p>
                <p className="text-xs text-muted-foreground">Basculez entre les themes</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Cles API</CardTitle>
            <CardDescription>Integrez Global Green Tax dans vos systemes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Production</p>
                <p className="text-xs font-mono text-muted-foreground">ggt_live_••••••••••••••••</p>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Sandbox</p>
                <p className="text-xs font-mono text-muted-foreground">ggt_test_••••••••••••••••</p>
              </div>
              <Badge variant="outline">Test</Badge>
            </div>
            <Separator />
            <Button variant="outline">Generer une nouvelle cle</Button>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Plan actuel</CardTitle>
                <CardDescription>Votre abonnement Global Green Tax</CardDescription>
              </div>
              <Badge className="bg-primary text-primary-foreground">Pro</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">6</p>
                <p className="text-xs text-muted-foreground">Pays actifs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">Illimite</p>
                <p className="text-xs text-muted-foreground">Simulations/mois</p>
              </div>
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-xs text-muted-foreground">Utilisateurs</p>
              </div>
            </div>
            <Separator />
            <Button variant="outline" className="w-full">Gerer l'abonnement</Button>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
