'use client';

import type { LineItem } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ResultCardProps {
  lineItems: LineItem[];
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-LU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ResultCard({ lineItems }: ResultCardProps) {
  const taxes = lineItems.filter((i) => i.amount < 0);
  const subsidies = lineItems.filter((i) => i.amount > 0);
  const neutral = lineItems.filter((i) => i.amount === 0);

  const totalTaxes = taxes.reduce((s, i) => s + i.amount, 0);
  const totalSubsidies = subsidies.reduce((s, i) => s + i.amount, 0);
  const netAmount = totalTaxes + totalSubsidies;
  const isNetPositive = netAmount >= 0;

  return (
    <div className="space-y-6">
      {/* ─── Summary Cards ───────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardDescription>Taxes & Charges</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {formatEur(totalTaxes)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {taxes.length} poste(s) fiscal(aux)
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Subventions & Économies</CardDescription>
            <CardTitle className="text-2xl text-primary">
              +{formatEur(totalSubsidies)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {subsidies.length} aide(s) éligible(s)
            </p>
          </CardContent>
        </Card>

        <Card className={isNetPositive ? 'border-primary/50 bg-primary/10' : 'border-destructive/50 bg-destructive/10'}>
          <CardHeader className="pb-2">
            <CardDescription>Position Nette</CardDescription>
            <CardTitle className={`text-2xl ${isNetPositive ? 'text-primary' : 'text-destructive'}`}>
              {isNetPositive ? '+' : ''}{formatEur(netAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {isNetPositive ? 'Gain net pour votre entreprise' : 'Charge nette pour votre entreprise'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Visual Bar ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subventions vs Taxes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-primary font-medium">Subventions</span>
                <span className="text-primary font-mono">{formatEur(totalSubsidies)}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{
                    width: `${totalSubsidies > 0 ? Math.min((totalSubsidies / (totalSubsidies + Math.abs(totalTaxes) || 1)) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-destructive font-medium">Taxes</span>
                <span className="text-destructive font-mono">{formatEur(Math.abs(totalTaxes))}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive transition-all duration-700"
                  style={{
                    width: `${totalTaxes < 0 ? Math.min((Math.abs(totalTaxes) / (totalSubsidies + Math.abs(totalTaxes) || 1)) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Detailed Line Items ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détail des postes</CardTitle>
          <CardDescription>
            Ventilation complète taxes, subventions et économies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Taxes */}
          {taxes.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-destructive mb-2 mt-1">Taxes & Charges</h4>
              {taxes.map((item) => (
                <LineItemRow key={item.code} item={item} />
              ))}
            </>
          )}

          {taxes.length > 0 && subsidies.length > 0 && (
            <Separator className="my-3" />
          )}

          {/* Subsidies */}
          {subsidies.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-primary mb-2">Subventions & Économies</h4>
              {subsidies.map((item) => (
                <LineItemRow key={item.code} item={item} />
              ))}
            </>
          )}

          {/* Neutral / non-eligible */}
          {neutral.length > 0 && (
            <>
              <Separator className="my-3" />
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Non éligible</h4>
              {neutral.map((item) => (
                <LineItemRow key={item.code} item={item} />
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LineItemRow({ item }: { item: LineItem }) {
  const isPositive = item.amount > 0;
  const isZero = item.amount === 0;

  return (
    <div className="flex items-start justify-between py-2.5 px-3 rounded-md hover:bg-accent/50 transition-colors group">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{item.label}</span>
          <Badge
            variant={isZero ? 'outline' : isPositive ? 'default' : 'destructive'}
            className="text-[10px] px-1.5 py-0"
          >
            {item.code}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {item.description}
        </p>
        {item.legalReference && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">
            Ref: {item.legalReference}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <span
          className={`text-sm font-mono font-semibold tabular-nums ${
            isZero
              ? 'text-muted-foreground'
              : isPositive
              ? 'text-primary'
              : 'text-destructive'
          }`}
        >
          {isPositive ? '+' : ''}
          {formatEur(item.amount)}
        </span>
      </div>
    </div>
  );
}
