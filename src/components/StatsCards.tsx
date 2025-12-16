import { TrendingUp, TrendingDown, Globe, BarChart3 } from "lucide-react";
import { CountryYieldData } from "@/types/yield";
import { useMemo } from "react";

interface StatsCardsProps {
  data: CountryYieldData[];
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-glow hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p
            className={`text-2xl font-bold font-mono ${
              trend === "up"
                ? "text-rate-positive"
                : trend === "down"
                ? "text-rate-negative"
                : "text-foreground"
            }`}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        highestYield: { value: "—", country: "N/A" },
        lowestYield: { value: "—", country: "N/A" },
        avgYield10Y: "—",
        countriesLoaded: 0,
      };
    }

    let highest = { rate: -Infinity, country: "" };
    let lowest = { rate: Infinity, country: "" };
    let sum10Y = 0;
    let count10Y = 0;

    data.forEach((country) => {
      const rate10Y = country.rates["10Y"];
      if (rate10Y !== null && rate10Y !== undefined) {
        sum10Y += rate10Y;
        count10Y++;

        if (rate10Y > highest.rate) {
          highest = { rate: rate10Y, country: country.country };
        }
        if (rate10Y < lowest.rate) {
          lowest = { rate: rate10Y, country: country.country };
        }
      }
    });

    return {
      highestYield: {
        value: highest.rate === -Infinity ? "—" : highest.rate.toFixed(2) + "%",
        country: highest.country || "N/A",
      },
      lowestYield: {
        value: lowest.rate === Infinity ? "—" : lowest.rate.toFixed(2) + "%",
        country: lowest.country || "N/A",
      },
      avgYield10Y:
        count10Y > 0 ? (sum10Y / count10Y).toFixed(2) + "%" : "—",
      countriesLoaded: data.length,
    };
  }, [data]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Highest 10Y Yield"
        value={stats.highestYield.value}
        subtitle={stats.highestYield.country}
        icon={<TrendingUp className="h-5 w-5 text-rate-negative" />}
        trend="up"
      />
      <StatCard
        title="Lowest 10Y Yield"
        value={stats.lowestYield.value}
        subtitle={stats.lowestYield.country}
        icon={<TrendingDown className="h-5 w-5 text-accent" />}
        trend="down"
      />
      <StatCard
        title="Average 10Y Yield"
        value={stats.avgYield10Y}
        subtitle="Across all countries"
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        trend="neutral"
      />
      <StatCard
        title="Countries Tracked"
        value={stats.countriesLoaded.toString()}
        subtitle="With available data"
        icon={<Globe className="h-5 w-5 text-muted-foreground" />}
        trend="neutral"
      />
    </div>
  );
}
