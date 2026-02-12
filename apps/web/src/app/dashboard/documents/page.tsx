'use client';

import { motion } from 'framer-motion';
import { PageTransition } from '@/components/dashboard/page-transition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const DOCUMENTS = [
  { name: 'Rapport Fiscal LU 2026', country: 'LU', date: '12 Fev 2026', type: 'PDF', size: '2.4 MB' },
  { name: 'Simulation France FY2026', country: 'FR', date: '10 Fev 2026', type: 'PDF', size: '1.8 MB' },
  { name: 'Analyse ROI Allemagne', country: 'DE', date: '08 Fev 2026', type: 'PDF', size: '3.1 MB' },
  { name: 'Audit Belgique Q1', country: 'BE', date: '05 Fev 2026', type: 'PDF', size: '1.2 MB' },
  { name: 'Bilan Espagne Solar', country: 'ES', date: '01 Fev 2026', type: 'PDF', size: '2.0 MB' },
  { name: 'Resumo Portugal 2026', country: 'PT', date: '28 Jan 2026', type: 'PDF', size: '1.5 MB' },
];

export default function DocumentsPage() {
  return (
    <PageTransition>
      <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            <p className="mt-1 text-muted-foreground">
              Rapports PDF generes et historique des exports
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Exporter tout
          </Button>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Rapports recents</CardTitle>
            <CardDescription>Cliquez pour telecharger ou previsualiser</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {DOCUMENTS.map((doc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent/50 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.date} · {doc.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs font-mono">
                      {doc.country}
                    </Badge>
                    <svg className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
